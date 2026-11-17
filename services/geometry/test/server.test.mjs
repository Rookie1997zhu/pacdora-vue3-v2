import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createServer} from 'node:net'
import {setTimeout as delay} from 'node:timers/promises'
import {after, before, test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'

const serviceRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const basePayload = {
  template_id: 'mailer-parametric-demo',
  length_mm: 300,
  width_mm: 200,
  height_mm: 50,
  size_mode: 'manufacturing',
}

let child
let origin
let serviceOutput = ''

async function availablePort() {
  const probe = createServer()
  await new Promise((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', resolve)
  })
  const {port} = probe.address()
  await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())))
  return port
}

async function post(path, body) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body),
  })
  return {response, payload: await response.json()}
}

before(async () => {
  const port = await availablePort()
  origin = `http://127.0.0.1:${port}`
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: serviceRoot,
    env: {...process.env, HOST: '127.0.0.1', PORT: String(port)},
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => {
    serviceOutput += chunk
  })
  child.stderr.on('data', (chunk) => {
    serviceOutput += chunk
  })
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`geometry server exited early:\n${serviceOutput}`)
    try {
      const response = await fetch(`${origin}/health`)
      if (response.ok) return
    } catch {
      // The listener may not be ready yet.
    }
    await delay(50)
  }
  throw new Error(`geometry server did not become ready:\n${serviceOutput}`)
})

after(async () => {
  if (!child || child.exitCode !== null) return
  const exited = once(child, 'exit')
  child.kill()
  await Promise.race([exited, delay(1_000)])
})

test('health and packing routes keep their existing contracts', async () => {
  const health = await fetch(`${origin}/health`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), {ok: true, service: 'boxcraft-geometry'})

  const {response, payload} = await post('/packing/solve', {
    inbox: {length_mm: 300, width_mm: 200, height_mm: 50},
    quantity: 1,
  })
  assert.equal(response.status, 200)
  assert.equal(payload.code, 'OK')
  assert.equal(payload.data.algorithm_version, 'boxcraft.outbox.v1')
})

test('validate accepts manufacturing size mode and returns stats plus issues', async () => {
  const {response, payload} = await post('/validate', basePayload)
  assert.equal(response.status, 200)
  assert.equal(payload.code, 'OK')
  assert.equal(payload.data.dimensions.sizeMode, 'manufacturing')
  assert.ok(payload.data.stats)
  assert.ok(Array.isArray(payload.data.issues))

  const invalid = await post('/validate', {...basePayload, size_mode: 'invalid'})
  assert.equal(invalid.response.status, 400)
  assert.equal(invalid.payload.code, 'INVALID_SIZE_MODE')
  assert.match(invalid.payload.message, /inner\|outer\|manufacturing/)
})

test('AI export accepts supported options and ignores unknown option keys', async () => {
  const {response, payload} = await post('/export', {
    ...basePayload,
    format: 'ai',
    options: {
      showDimensions: false,
      showBleed: true,
      showFaceNames: false,
      showTitleBlock: true,
      displayUnit: 'in',
      locale: 'ko-KR',
      futureOption: 'ignored',
    },
  })
  assert.equal(response.status, 200)
  assert.equal(payload.data.mime, 'application/pdf')
  assert.match(payload.data.filename, /\.ai$/)
  assert.equal(Buffer.from(payload.data.content_base64, 'base64').subarray(0, 4).toString(), '%PDF')
})

test('thumbnail returns compact normalized trim and crease SVG', async () => {
  const {response, payload} = await post('/thumbnail', basePayload)
  assert.equal(response.status, 200)
  assert.equal(payload.data.mime, 'image/svg+xml')
  assert.equal(payload.data.byte_length, Buffer.byteLength(payload.data.svg))
  assert.ok(payload.data.byte_length < 20 * 1024)
  assert.match(payload.data.svg, /viewBox="0 0 [\d.]+ [\d.]+"/)
  assert.match(payload.data.svg, /id="trim"/)
  assert.match(payload.data.svg, /id="crease"/)
  assert.doesNotMatch(payload.data.svg, /bleed|DIMENSIONS/i)
})

test('request bodies over 256KB return BODY_TOO_LARGE', async () => {
  const {response, payload} = await post('/validate', {
    ...basePayload,
    padding: 'x'.repeat(256 * 1024),
  })
  assert.equal(response.status, 413)
  assert.equal(payload.code, 'BODY_TOO_LARGE')
})
