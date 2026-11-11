import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { dataRaw, evidenceRoot, reportsDir } from '../paths.ts'

function sha256(buf: Buffer) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function sniff(buf: Buffer, ext: string): { ok: boolean; reason: string } {
  if (ext === '.svg') {
    const head = buf.subarray(0, 400).toString('utf8')
    if (/AccessDenied|Error>\s*<Code>/i.test(head)) return { ok: false, reason: 'cdn_access_denied_stub_not_dieline' }
    if (!/<svg[\s>]/i.test(head)) return { ok: false, reason: 'not_svg_root' }
    return { ok: true, reason: 'svg' }
  }
  if (ext === '.eps') {
    const head = buf.subarray(0, 32).toString('latin1')
    if (!(head.startsWith('%!PS') || head.includes('EPSF') || buf[0] === 0xc5)) {
      return { ok: false, reason: 'not_eps_header' }
    }
    return { ok: true, reason: 'eps_indexed_only' }
  }
  if (ext === '.json') return { ok: true, reason: 'json_meta' }
  return { ok: true, reason: 'passthrough' }
}

export function importOffline() {
  const invPath = path.join(reportsDir, 'evidence-inventory.json')
  const inv = JSON.parse(fs.readFileSync(invPath, 'utf8'))
  const items = []
  for (const it of inv.items) {
    const abs = path.join(evidenceRoot, it.name)
    if (!fs.existsSync(abs)) continue
    if (!['.svg', '.eps', '.json'].includes(path.extname(it.name).toLowerCase())) continue
    const buf = fs.readFileSync(abs)
    const check = sniff(buf, path.extname(it.name).toLowerCase())
    const sampleId = it.name.replace(/\.[^.]+$/, '')
    items.push({
      sample_id: sampleId,
      name: it.name,
      abs_readonly: abs,
      sha256: sha256(buf),
      bytes: buf.length,
      product: it.product,
      dims_mm_guess: it.dims_mm_guess,
      import_ok: check.ok,
      import_reason: check.reason,
      role: it.role,
    })
  }
  const manifest = {
    generated_at: new Date().toISOString(),
    source: 'offline_readonly_evidence',
    count: items.length,
    items,
  }
  fs.mkdirSync(dataRaw, { recursive: true })
  fs.writeFileSync(path.join(dataRaw, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('import-offline', manifest.count)
  return manifest
}

importOffline()
