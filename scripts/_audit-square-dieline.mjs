/**
 * One-shot: open each square CSV detail on pacdora.cn and check .mockup-edit-download.
 * Writes docs/pacdora_square_boxes/rea/square_dieline_audit.json
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const csvPath = join(root, 'docs', 'pacdora_square_boxes', 'square_boxes.csv')
const outDir = join(root, 'docs', 'pacdora_square_boxes', 'rea')
mkdirSync(outDir, { recursive: true })

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const headers = splitCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = cols[i] ?? '' })
    return row
  })
}

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue }
      inQ = !inQ
      continue
    }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

const rows = parseCsv(readFileSync(csvPath, 'utf8'))
const items = rows.map((r) => ({
  num: String(r['模型编号'] || '').trim(),
  key: String(r['mockupNameKey'] || '').trim(),
  name: String(r['名称'] || '').trim(),
}))

console.log(`auditing ${items.length} items…`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const results = []

for (let i = 0; i < items.length; i++) {
  const it = items[i]
  const url = `https://www.pacdora.cn/mockup-detail/${it.key}`
  let decision = 'drop'
  let reason = 'unknown'
  let hasDownload = false
  let title = ''
  let is404 = false
  let plasticUi = false
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    const status = resp?.status() ?? 0
    await page.waitForTimeout(1800)
    title = await page.title()
    is404 = status === 404 || /404|页面不存在/i.test(title) || await page.locator('text=页面不存在').count().then((n) => n > 0).catch(() => false)
    if (is404) {
      reason = 'detail_404'
    } else {
      hasDownload = await page.locator('.mockup-edit-download').count().then(async (n) => {
        if (n > 0) return true
        return page.getByText('下载刀版', { exact: false }).count().then((m) => m > 0)
      })
      const body = await page.locator('body').innerText().catch(() => '')
      plasticUi = /油光塑料|磨砂塑料|自定义材质\s*塑料/.test(body)
      if (hasDownload) {
        decision = 'keep'
        reason = 'has_mockup_edit_download'
      } else if (plasticUi) {
        reason = 'no_download_plastic_ui'
      } else {
        reason = 'no_mockup_edit_download'
      }
    }
  } catch (e) {
    reason = `nav_error:${String(e?.message || e).slice(0, 120)}`
  }
  const row = { num: it.num, key: it.key, name: it.name, url, decision, reason, hasDownload, is404, plasticUi, title }
  results.push(row)
  console.log(`[${i + 1}/${items.length}] ${it.num} ${decision} ${reason}`)
}

await browser.close()

const keep = results.filter((r) => r.decision === 'keep')
const drop = results.filter((r) => r.decision === 'drop')
const audit = {
  generatedAt: new Date().toISOString(),
  rule: 'keep iff .mockup-edit-download (or 下载刀版 text) present on pacdora.cn detail; drop on 404 or missing download',
  total: results.length,
  keepCount: keep.length,
  dropCount: drop.length,
  keepNums: keep.map((r) => r.num),
  dropNums: drop.map((r) => r.num),
  items: results,
}

const outPath = join(outDir, 'square_dieline_audit.json')
writeFileSync(outPath, JSON.stringify(audit, null, 2) + '\n')
console.log(JSON.stringify({ outPath, keep: keep.length, drop: drop.length, dropNums: drop.map((r) => r.num) }, null, 2))
