/**
 * Capture homepage hero fold video via Playwright frame dump + ffmpeg.
 * Usage (from pacdora-vue3-v2/):
 *   node scripts/hero-fold-capture/run.mjs
 * Optional: HERO_CAPTURE_BASE=http://127.0.0.1:5173
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outDir = join(root, 'public', 'hero')
const framesDir = join(root, 'scripts', 'hero-fold-capture', '.tmp', 'frames')
mkdirSync(outDir, { recursive: true })
mkdirSync(framesDir, { recursive: true })

const require = createRequire(import.meta.url)

function loadPlaywright() {
  try {
    return require('playwright')
  } catch {
    return null
  }
}

function ffmpegBin() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: true })
  if (r.status === 0) return 'ffmpeg'
  throw new Error('ffmpeg not found on PATH')
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitHttp(url, timeoutMs = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {
      /* retry */
    }
    await sleep(400)
  }
  throw new Error(`server not ready: ${url}`)
}

async function main() {
  const ffmpeg = ffmpegBin()
  let pw = loadPlaywright()
  if (!pw?.chromium) {
    console.log('playwright not in node_modules; trying dynamic import…')
    try {
      pw = await import('playwright')
    } catch {
      throw new Error('playwright missing: npm i -D playwright && npx playwright install chromium')
    }
  }

  const baseEnv = String(process.env.HERO_CAPTURE_BASE || '').replace(/\/$/, '')
  let child = null
  let base = baseEnv

  if (!base) {
    const port = 5199
    base = `http://127.0.0.1:${port}`
    console.log(`starting vite on ${base}…`)
    const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
    child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, VITE_ROOT_HOME: '1' },
    })
    child.stdout?.on('data', (d) => process.stdout.write(d))
    child.stderr?.on('data', (d) => process.stderr.write(d))
    await waitHttp(`${base}/`)
  }

  // Clear previous frames
  rmSync(framesDir, { recursive: true, force: true })
  mkdirSync(framesDir, { recursive: true })

  const browser = await pw.chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  })
  const page = await browser.newPage({
    viewport: { width: 1000, height: 900 },
    deviceScaleFactor: 1,
  })

  const url = `${base}/lab/hero-fold-capture?auto=1`
  console.log(`open ${url}`)
  await page.goto(url, { waitUntil: 'load', timeout: 120000 })
  await sleep(800)

  const deadline = Date.now() + 180000
  let meta = null
  while (Date.now() < deadline) {
    try {
      if (page.isClosed()) throw new Error('page closed')
      meta = await page.evaluate(() => {
        const s = window.__HERO_CAPTURE__
        if (!s) return null
        return {
          status: s.status,
          error: s.error,
          totalFrames: s.totalFrames,
          fps: s.fps,
        }
      })
    } catch (err) {
      process.stdout.write(`\revaluate: ${err instanceof Error ? err.message : err}   `)
      await sleep(500)
      continue
    }
    if (meta?.status === 'ready' || meta?.status === 'error') break
    process.stdout.write(`\rboot: ${meta?.status || 'none'}   `)
    await sleep(300)
  }
  process.stdout.write('\n')
  if (!meta || meta.status === 'error') {
    throw new Error(meta?.error || 'capture page failed to become ready')
  }

  const total = Number(meta.totalFrames) || 225
  const fps = Number(meta.fps) || 30
  console.log(`dumping ${total} frames @ ${fps}fps…`)

  let posterIdx = Math.round(5.5 * fps)
  for (let i = 0; i < total; i++) {
    const dataUrl = await page.evaluate(async (idx) => {
      return window.__HERO_CAPTURE__.renderFrame(idx)
    }, i)
    if (!dataUrl?.startsWith('data:')) throw new Error(`bad frame ${i}`)
    const b64 = dataUrl.split(',')[1] || ''
    const name = `frame_${String(i).padStart(4, '0')}.jpg`
    writeFileSync(join(framesDir, name), Buffer.from(b64, 'base64'))
    if (i === posterIdx || (i === total - 1 && !existsSync(join(outDir, 'fold-poster.jpg')))) {
      /* poster written after loop from chosen frame */
    }
    if (i % 15 === 0 || i === total - 1) {
      process.stdout.write(`\rframes ${i + 1}/${total}   `)
    }
  }
  process.stdout.write('\n')

  await browser.close()
  if (child) {
    try {
      child.kill()
    } catch {
      /* ignore */
    }
  }

  const webmPath = join(outDir, 'fold-loop.webm')
  const mp4Path = join(outDir, 'fold-loop.mp4')
  const posterPath = join(outDir, 'fold-poster.jpg')
  const pattern = join(framesDir, 'frame_%04d.jpg')

  // Copy poster from mid-fold hold frame
  const posterFrame = join(framesDir, `frame_${String(posterIdx).padStart(4, '0')}.jpg`)
  if (existsSync(posterFrame)) {
    writeFileSync(posterPath, require('node:fs').readFileSync(posterFrame))
  }

  function runFfmpeg(args) {
    const r = spawnSync(ffmpeg, args, { stdio: 'inherit', windowsHide: true })
    if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`)
  }

  console.log('ffmpeg → webm…')
  runFfmpeg([
    '-y',
    '-framerate',
    String(fps),
    '-i',
    pattern,
    '-an',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '1.2M',
    '-pix_fmt',
    'yuv420p',
    webmPath,
  ])

  console.log('ffmpeg → mp4…')
  runFfmpeg([
    '-y',
    '-framerate',
    String(fps),
    '-i',
    pattern,
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-b:v',
    '1.4M',
    '-movflags',
    '+faststart',
    mp4Path,
  ])

  if (!existsSync(posterPath)) {
    runFfmpeg(['-y', '-ss', '5.5', '-i', mp4Path, '-frames:v', '1', '-q:v', '3', posterPath])
  }

  for (const p of [webmPath, mp4Path, posterPath]) {
    const kb = Math.round(statSync(p).size / 1024)
    console.log(`wrote ${p} (${kb} KB)`)
  }
  console.log('hero fold capture done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
