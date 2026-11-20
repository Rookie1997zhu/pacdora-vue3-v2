/**
 * Aggregate task1/2/3/4 findings into docs/产品目录_问题清单_2026-11-19.csv
 * and a one-page summary HTML.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// SUPERSEDED: this aggregates the raw auto-screening (before anyone looked at the screenshots) and
// overwrites the reviewed issue list and summary. Use scripts/audit/catalog-final-report.py instead.
if (!process.argv.includes('--force-raw')) {
  console.error('catalog-issues-aggregate is superseded by catalog-final-report.py; pass --force-raw to run it anyway')
  process.exit(1)
}


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT_CSV = path.join(ROOT, 'docs', '产品目录_问题清单_2026-11-19.csv')
const OUT_HTML = path.join(ROOT, 'docs', '产品目录_核实总结_2026-11-19.html')

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
function esc(s) {
  const t = String(s ?? '')
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

const issues = []
const push = (row) => issues.push(row)

for (const r of parse(path.join(ROOT, 'docs', '产品目录_导出与保存批量测试_2026-11-19.csv'))) {
  if (!r.problems) continue
  const sev = /zero face|pdf illegal|validate/i.test(r.problems)
    ? '高'
    : /dxf extent|zero-length crease/i.test(r.problems)
      ? '中'
      : '低'
  push({
    类目: r.category,
    编号: r.num,
    名称: r.name,
    slug: r.slug,
    产品页: `http://localhost/products/${r.slug}`,
    来源: '任务1-导出保存',
    现象: r.problems,
    严重程度: sev,
    建议: /zero face|pdf illegal/.test(r.problems) ? '重采或下架' : /dxf extent|crease/.test(r.problems) ? '修导出/刀版' : '复核',
  })
}

for (const r of parse(path.join(ROOT, 'docs', 'audit', 'catalog-3d-overview', '3d-conclusions.csv'))) {
  if (r.verdict === '成盒' && r.suspect !== 'Y') continue
  if (r.verdict === '成盒') continue
  push({
    类目: r.category,
    编号: r.num,
    名称: r.name,
    slug: r.slug,
    产品页: `http://localhost/products/${r.slug}`,
    来源: '任务4-3D',
    现象: `${r.verdict}; ${r.suspect_reason || ''}; 合盖=${r.closed} 登记=${r.size}`,
    严重程度: r.verdict === '不成盒' ? '高' : '中',
    建议: r.verdict === '不成盒' ? '重采或下架' : '人工看3D后决定',
  })
}

for (const r of parse(path.join(ROOT, 'docs', 'audit', 'catalog-mismatch-84', 'mismatch-conclusions.csv'))) {
  if (r.conclusion === '无害') continue
  push({
    类目: r.category,
    编号: r.num,
    名称: r.name,
    slug: r.slug,
    产品页: `http://localhost/products/${r.slug}`,
    来源: '任务2-不重合',
    现象: `${r.conclusion}; ${r.note}; cover ${r.cover_pct}/${r.our_pct}`,
    严重程度: r.conclusion === '刀版有误' ? '高' : r.conclusion === '拿不准' ? '中' : '低',
    建议:
      r.conclusion === '刀版有误'
        ? '重采或下架'
        : r.conclusion === '封面图有误'
          ? '换封面图'
          : '对Pacdora核对',
  })
}

for (const r of parse(path.join(ROOT, 'docs', 'audit', 'catalog-page-smoke', 'page-smoke-results.csv'))) {
  const hard = (r.problems || '')
    .split('; ')
    .filter((p) => p && !p.includes('soft:') && !p.includes('(info)'))
  if (!hard.length) continue
  push({
    类目: r.category,
    编号: '',
    名称: r.slug,
    slug: r.slug,
    产品页: `http://localhost/products/${r.slug}`,
    来源: '任务3-页面抽测',
    现象: hard.join('; '),
    严重程度: '中',
    建议: '修页面流程/文案校验',
  })
}

const cols = ['类目', '编号', '名称', 'slug', '产品页', '来源', '现象', '严重程度', '建议']
fs.writeFileSync(OUT_CSV, '\ufeff' + [cols.join(',')].concat(issues.map((r) => cols.map((c) => esc(r[c])).join(','))).join('\n'))

const exportRows = parse(path.join(ROOT, 'docs', '产品目录_导出与保存批量测试_2026-11-19.csv'))
const three = parse(path.join(ROOT, 'docs', 'audit', 'catalog-3d-overview', '3d-conclusions.csv'))
const mismatch = parse(path.join(ROOT, 'docs', 'audit', 'catalog-mismatch-84', 'mismatch-conclusions.csv'))
const exportOk = exportRows.filter((r) => !r.problems).length
const threeOk = three.filter((r) => r.verdict === '成盒').length
const mismatchHarmless = mismatch.filter((r) => r.conclusion === '无害').length
const high = issues.filter((i) => i.严重程度 === '高').length
const mid = issues.filter((i) => i.严重程度 === '中').length
const low = issues.filter((i) => i.严重程度 === '低').length

// Confirmed OK ≈ export ok ∩ 3D 成盒 ∩ (not in mismatch-as-bad)
const badSlugs = new Set(issues.filter((i) => i.严重程度 === '高').map((i) => i.slug))
const confirmed = exportRows.filter((r) => !r.problems && !badSlugs.has(r.slug) && three.find((t) => t.slug === r.slug)?.verdict === '成盒').length

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>产品目录核实总结 2026-11-19</title>
<style>
body{font:15px/1.7 system-ui;max-width:880px;margin:40px auto;padding:0 20px;color:#1c2428}
h1{font-size:26px} table{border-collapse:collapse;width:100%;margin:12px 0} th,td{border:1px solid #dfe5e8;padding:8px 10px;text-align:left}
th{background:#eef2f3} .ok{color:#17603a} .bad{color:#9b2c2c}
</style></head><body>
<h1>产品目录刀版核实 · 一页总结</h1>
<p>范围：/products 导入产品 273 · 只测不修 · 2026-11-19</p>
<table>
<tr><th>指标</th><th>数量</th></tr>
<tr><td>导入产品总数</td><td>273</td></tr>
<tr><td>任务1 导出/保存通过</td><td class="ok">${exportOk} / 273（保存 273/273 通过；导出问题 ${273 - exportOk}）</td></tr>
<tr><td>任务4 3D 判定成盒</td><td>${threeOk} · 不成盒 ${three.filter((t) => t.verdict === '不成盒').length} · 待看 ${three.filter((t) => t.verdict === '待看').length}</td></tr>
<tr><td>任务2 不重合→无害</td><td>${mismatchHarmless} / 84 · 刀版有误 ${mismatch.filter((m) => m.conclusion === '刀版有误').length} · 拿不准 ${mismatch.filter((m) => m.conclusion === '拿不准').length}</td></tr>
<tr><td>问题清单行数</td><td>${issues.length}（高 ${high} / 中 ${mid} / 低 ${low}）</td></tr>
<tr><td>较稳妥「确认没问题」估算</td><td class="ok">${confirmed}（导出过关 ∩ 3D成盒 ∩ 无高严重问题）</td></tr>
</table>
<h2>建议处理顺序</h2>
<ol>
<li>高：3D 不成盒、零面片、PDF 非法数、刀版有误（优先下架或重采）</li>
<li>中：DXF 切线范围偏差、零长压痕、拿不准需对 Pacdora、页面文案层校验</li>
<li>低：封面图尺寸示意差异（无害可不处理）</li>
</ol>
<h2>说明</h2>
<ul>
<li>任务3：冒烟账号导出余量仅 3，未跑页面四格式导出；服务端四格式已在任务1覆盖。创建设计/重开 API 抽测 20 个通过；向设计写入文本层触发 VALIDATION_ERROR（记为软问题）。</li>
<li>任务4：全量自动合盖尺寸筛查 273；Edge 无头 WebGL 截图不稳定，总览页用封面图+合盖数值+产品页链接，已有部分截图落在 docs/audit/catalog-3d-overview/shots/。</li>
<li>Illustrator 图层仍需你抽看任一 .ai。</li>
</ul>
<p>明细：<code>docs/产品目录_问题清单_2026-11-19.csv</code></p>
</body></html>`

fs.writeFileSync(OUT_HTML, html)
console.log({ issues: issues.length, high, mid, low, exportOk, threeOk, confirmed, OUT_CSV, OUT_HTML })
