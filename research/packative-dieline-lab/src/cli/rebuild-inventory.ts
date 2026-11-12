import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { evidenceRoot, reportsDir } from '../paths.ts'
import { parseProductDimsFromName } from '../normalize/svgParse.ts'

type Role =
  | 'vector_svg'
  | 'vector_eps'
  | 'json_meta'
  | 'mask_or_raster'
  | 'other'
  | 'cdn_access_denied_stub'
  | 'invalid_svg'

type InvItem = {
  path: string
  name: string
  bytes: number
  sha256: string
  ext: string
  product: string | null
  dims_mm_guess: string | null
  role: Role
  svg_ok?: boolean
  svg_reason?: string
}

function sha256(buf: Buffer) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function guessProduct(name: string): string | null {
  if (/crashlock/i.test(name)) return 'productbox-crashlock'
  if (/mailer/i.test(name)) return 'mailer'
  if (/sleeve/i.test(name)) return 'sleeve'
  if (/pillow/i.test(name)) return 'pillow'
  return null
}

function dimsGuess(name: string): string | null {
  const d = parseProductDimsFromName(name)
  return d ? `${d.L}x${d.W}x${d.H}` : null
}

/** Sniff SVG quality for ingest gate (same bar as online collect). */
export function sniffSvg(text: string): { ok: boolean; reason: string; role: Role } {
  if (/AccessDenied|Error>\s*<Code>/i.test(text.slice(0, 800))) {
    return { ok: false, reason: 'cdn_access_denied_stub', role: 'cdn_access_denied_stub' }
  }
  if (!/<svg[\s>]/i.test(text.slice(0, 800))) {
    return { ok: false, reason: 'not_svg_root', role: 'invalid_svg' }
  }
  if (!/ev-style\s*=\s*"Cutting"/i.test(text)) {
    return { ok: false, reason: 'missing_cutting', role: 'invalid_svg' }
  }
  if (!/ev-style\s*=\s*"Creasing"/i.test(text)) {
    return { ok: false, reason: 'missing_creasing', role: 'invalid_svg' }
  }
  return { ok: true, reason: 'valid_cutting_creasing_svg', role: 'vector_svg' }
}

function roleForExt(ext: string, name: string): Role {
  if (ext === 'svg') return 'vector_svg'
  if (ext === 'eps') return 'vector_eps'
  if (ext === 'json') return 'json_meta'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'mask_or_raster'
  if (/\.png$/i.test(name) || /mask/i.test(name)) return 'mask_or_raster'
  return 'other'
}

export function rebuildInventory() {
  fs.mkdirSync(reportsDir, { recursive: true })
  const names = fs.readdirSync(evidenceRoot).filter((n) => !n.startsWith('.'))
  const items: InvItem[] = []
  const ingestLog: Array<Record<string, unknown>> = []
  let vectorSvgCount = 0
  let validCrashlockSvg = 0
  let stubSvg = 0

  const PRIORITY_SINGLE_VAR = new Set([
    '90x80x80',
    '110x80x80',
    '100x70x80',
    '100x80x70',
    '100x80x90',
    '100x80x50',
    '120x90x60',
  ])
  const existingReal = new Set(['55x55x75', '100x80x80', '100x90x80', '200x150x100'])

  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    const abs = path.join(evidenceRoot, name)
    const st = fs.statSync(abs)
    if (!st.isFile()) continue
    const ext = path.extname(name).slice(1).toLowerCase()
    const buf = fs.readFileSync(abs)
    const relPath = path.join('docs', 'packative-research', 'evidence', name)
    const base: InvItem = {
      path: relPath.replace(/\//g, path.sep),
      name,
      bytes: buf.length,
      sha256: sha256(buf),
      ext,
      product: guessProduct(name),
      dims_mm_guess: dimsGuess(name),
      role: roleForExt(ext, name),
    }

    if (ext === 'svg') {
      const text = buf.toString('utf8')
      const sniff = sniffSvg(text)
      base.role = sniff.role
      base.svg_ok = sniff.ok
      base.svg_reason = sniff.reason
      if (sniff.ok) {
        vectorSvgCount++
        if (base.product === 'productbox-crashlock') validCrashlockSvg++
      } else if (sniff.role === 'cdn_access_denied_stub') {
        stubSvg++
      }
      ingestLog.push({
        name,
        dims: base.dims_mm_guess,
        product: base.product,
        ok: sniff.ok,
        reason: sniff.reason,
        sha256: base.sha256,
        bytes: base.bytes,
        priority_single_var: PRIORITY_SINGLE_VAR.has(base.dims_mm_guess || ''),
        already_known_real: existingReal.has(base.dims_mm_guess || ''),
      })
    }

    items.push(base)
  }

  const inventory = {
    generated_at: new Date().toISOString(),
    source_root: 'docs/packative-research/evidence',
    count: items.length,
    vector_svg_count: vectorSvgCount,
    items,
  }
  fs.writeFileSync(path.join(reportsDir, 'evidence-inventory.json'), JSON.stringify(inventory, null, 2))

  const newPriorityOk = ingestLog.filter(
    (r) => r.ok && r.priority_single_var && !r.already_known_real && r.product === 'productbox-crashlock',
  )
  const log = {
    generated_at: new Date().toISOString(),
    evidence_root: evidenceRoot,
    scanned_files: names.length,
    inventory_count: items.length,
    vector_svg_count: vectorSvgCount,
    valid_crashlock_svg: validCrashlockSvg,
    stub_svg: stubSvg,
    new_priority_single_var_ok: newPriorityOk.length,
    target_new_single_var: 3,
    sample_gap: Math.max(0, 3 - newPriorityOk.length),
    note:
      newPriorityOk.length >= 3
        ? 'offline_single_var_target_met'
        : 'offline_single_var_target_not_met_rerun_with_existing_samples',
    entries: ingestLog.filter((r) => String(r.name).includes('crashlock') || String(r.name).includes('studio-dieline')),
  }
  fs.writeFileSync(path.join(reportsDir, 'offline-ingest-log.json'), JSON.stringify(log, null, 2))
  console.log(
    'rebuild-inventory',
    inventory.count,
    'svg_ok',
    vectorSvgCount,
    'new_priority',
    newPriorityOk.length,
  )
  return { inventory, log }
}

rebuildInventory()
