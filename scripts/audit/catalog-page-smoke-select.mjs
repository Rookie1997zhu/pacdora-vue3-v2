/**
 * Pick 16–20 catalog products for page-flow smoke per plan rules.
 * Writes docs/audit/catalog-page-smoke/selection.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'docs', 'audit', 'catalog-page-smoke')
fs.mkdirSync(OUT, { recursive: true })

function parse(p) {
  if (!fs.existsSync(p)) return []
  const lines = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  const h = split(lines[0])
  return lines.slice(1).map((line) => {
    const c = split(line)
    const o = {}
    h.forEach((k, i) => (o[k] = c[i]))
    return o
  })
}
function split(line) {
  const cols = []
  let cur = '',
    q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"'
        i++
      } else q = !q
      continue
    }
    if (ch === ',' && !q) {
      cols.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  cols.push(cur)
  return cols
}

const baseline = parse(path.join(ROOT, 'docs', '上线产品刀版核实结果_2026-11-19.csv'))
const exportRows = parse(path.join(ROOT, 'docs', '产品目录_导出与保存批量测试_2026-11-19.csv'))
const three = parse(path.join(ROOT, 'docs', 'audit', 'catalog-3d-overview', '3d-conclusions.csv'))
const mismatch = parse(path.join(ROOT, 'docs', 'audit', 'catalog-mismatch-84', 'mismatch-conclusions.csv'))

const bySlug = {}
for (const r of baseline) bySlug[r.slug] = { ...r, layers: Number(r['图层数'] || 1) }
for (const r of exportRows) Object.assign(bySlug[r.slug] || (bySlug[r.slug] = { slug: r.slug }), { exportProblems: r.problems, category: r.category || bySlug[r.slug]?.category })
for (const r of three) Object.assign(bySlug[r.slug] || (bySlug[r.slug] = { slug: r.slug }), { three: r.verdict, suspect: r.suspect })
for (const r of mismatch) Object.assign(bySlug[r.slug] || (bySlug[r.slug] = { slug: r.slug }), { mismatch: r.conclusion })

const cats = ['gift', 'mailer', 'square', 'shipping', '礼盒', '邮寄盒', '方形盒', '运输箱']
const catKey = (r) => {
  const c = r.category || r['类目'] || ''
  if (/gift|礼盒/.test(c)) return 'gift'
  if (/mailer|邮寄/.test(c)) return 'mailer'
  if (/square|方形/.test(c)) return 'square'
  if (/shipping|运输/.test(c)) return 'shipping'
  return c || 'other'
}

const scored = Object.values(bySlug)
  .filter((r) => String(r.slug || '').startsWith('import-'))
  .map((r) => {
    let score = 0
    if (r.exportProblems) score += 5
    if (r.suspect === 'Y') score += 4
    if (r.three === '不成盒' || r.three === '待看') score += 3
    if (r.mismatch && r.mismatch !== '无害') score += 3
    if (Number(r.layers) > 1 || Number(r['图层数']) > 1) score += 2
    return { ...r, cat: catKey(r), score, multi: Number(r.layers || r['图层数'] || 1) > 1 }
  })
  .sort((a, b) => b.score - a.score)

const picked = []
const perCat = { gift: 0, mailer: 0, square: 0, shipping: 0 }
for (const r of scored) {
  if (picked.length >= 20) break
  if (!perCat[r.cat] && perCat[r.cat] !== 0) continue
  if (perCat[r.cat] >= 5 && picked.length >= 16) continue
  if (perCat[r.cat] >= 5) continue
  picked.push(r)
  perCat[r.cat]++
}
// ensure >=4 per cat
for (const c of ['gift', 'mailer', 'square', 'shipping']) {
  while (perCat[c] < 4) {
    const extra = scored.find((r) => r.cat === c && !picked.includes(r))
    if (!extra) break
    picked.push(extra)
    perCat[c]++
  }
}
// ensure >=5 multi-layer
let multi = picked.filter((r) => r.multi).length
if (multi < 5) {
  for (const r of scored.filter((x) => x.multi)) {
    if (multi >= 5) break
    if (picked.includes(r)) continue
    picked.push(r)
    multi++
  }
}

const selection = picked.slice(0, 20).map((r) => ({
  slug: r.slug,
  category: r.cat,
  name: r.name || r['名称'],
  multi: !!r.multi,
  reason: [
    r.exportProblems && 'export_issue',
    r.suspect === 'Y' && '3d_suspect',
    r.mismatch && r.mismatch !== '无害' && `mismatch:${r.mismatch}`,
    r.multi && 'multi_layer',
    r.score === 0 && 'random_ok',
  ]
    .filter(Boolean)
    .join('|'),
}))

fs.writeFileSync(path.join(OUT, 'selection.json'), JSON.stringify({ count: selection.length, perCat, multi, selection }, null, 2))
console.log(JSON.stringify({ count: selection.length, perCat, multi, selection }, null, 2))
