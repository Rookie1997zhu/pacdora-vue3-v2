import fs from 'node:fs'

const csvPath = 'docs/产品目录_导出与保存批量测试_2026-11-19.csv'
const save = JSON.parse(fs.readFileSync('docs/产品目录_导出与保存批量测试_save.json', 'utf8'))
const text = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
const lines = text.trim().split(/\r?\n/)
const header = lines[0].split(',')
const idx = Object.fromEntries(header.map((h, i) => [h, i]))

function parseRow(line) {
  const cols = []
  let cur = ''
  let q = false
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

function esc(v) {
  const t = String(v ?? '')
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

const out = [header.join(',')]
let fail = 0
for (const line of lines.slice(1)) {
  const cols = parseRow(line)
  const slug = cols[idx.slug]
  const s = save[slug]
  if (s) {
    cols[idx.save_ok] = s.save_ok
    cols[idx.save_reject_resize] = s.save_reject_resize
  }
  let problems = (cols[idx.problems] || '')
    .split('; ')
    .filter(Boolean)
    .filter((p) => !/RATE_LIMITED|save original|save resize/.test(p))
  if (s?.problems?.length) problems.push(...s.problems)
  cols[idx.problems] = problems.join('; ')
  if (problems.length) fail++
  out.push(cols.map(esc).join(','))
}
fs.writeFileSync(csvPath, '\ufeff' + out.join('\n'))
console.log(`rows ${out.length - 1} fail ${fail} ok ${out.length - 1 - fail}`)
