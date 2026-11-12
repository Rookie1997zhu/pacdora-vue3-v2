import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { dataRaw } from '../paths.ts'

function sha256(buf: Buffer) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

/** Build manifest exclusively from online-collected live/*.eps (no offline evidence import). */
export function importLive() {
  const liveDir = path.join(dataRaw, 'live')
  if (!fs.existsSync(liveDir)) throw new Error('missing data/raw/live — run online-collect first')
  const items = []
  for (const name of fs.readdirSync(liveDir).filter((n) => n.endsWith('.eps')).sort()) {
    const abs = path.join(liveDir, name)
    const buf = fs.readFileSync(abs)
    const metaPath = abs.replace(/\.eps$/, '.meta.json')
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {}
    const sampleId = name.replace(/\.eps$/, '')
    const m = sampleId.match(/(\d+)_(\d+)_(\d+)/)
    items.push({
      sample_id: sampleId,
      name,
      abs_readonly: abs,
      sha256: sha256(buf),
      bytes: buf.length,
      product: meta.product || 'productbox-crashlock',
      dims_mm_guess: m ? `${m[1]}x${m[2]}x${m[3]}` : null,
      L: meta.length ?? (m ? Number(m[1]) : null),
      W: meta.width ?? (m ? Number(m[2]) : null),
      H: meta.height ?? (m ? Number(m[3]) : null),
      group: meta.group || null,
      import_ok: true,
      import_reason: 'live_papi_eps',
      role: 'vector_eps_live',
      source: 'online',
    })
  }
  const manifest = {
    generated_at: new Date().toISOString(),
    source: 'online_live_only',
    offline_evidence_used: false,
    count: items.length,
    items,
  }
  fs.writeFileSync(path.join(dataRaw, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('import-live', manifest.count)
  return manifest
}

importLive()
