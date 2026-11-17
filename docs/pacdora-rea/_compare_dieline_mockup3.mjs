import { writeFileSync } from 'node:fs'

async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

async function fetchAll(param, key, pageSize = 60) {
  const byNum = new Map()
  let current = 1
  let apiTotal = null
  for (;;) {
    const url =
      `https://www.pacdora.cn/api/v2/models?pageSize=${pageSize}&current=${current}` +
      `&${param}=${encodeURIComponent(key)}`
    const j = await getJson(url)
    if (apiTotal == null) apiTotal = Number(j.total || 0)
    const batch = j.data || []
    if (!batch.length) break
    const before = byNum.size
    for (const x of batch) byNum.set(String(x.num), x)
    console.log(
      `  ${param}=${key} current=${current} got=${batch.length} unique=${byNum.size}/${apiTotal}`,
    )
    if (byNum.size === before) break
    if (byNum.size >= apiTotal) break
    current += 1
    if (current > 80) break
  }
  return { apiTotal, unique: byNum }
}

function intersect(a, b) {
  const inter = []
  const onlyA = []
  const onlyB = []
  for (const n of a.keys()) (b.has(n) ? inter : onlyA).push(n)
  for (const n of b.keys()) if (!a.has(n)) onlyB.push(n)
  return { inter, onlyA, onlyB }
}

const pairs = [
  ['礼盒', 'gift-box-dielines', 'gift-box-mockups'],
  ['运输箱', 'shipping-box-dielines', 'shipping-box-mockups'],
  ['邮寄盒', 'mailer-box-dielines', 'mailer-box-mockups'],
  ['食品', 'food-box-dielines', 'food-packaging-mockups'],
  ['咖啡', 'coffee-packaging-dielines', 'coffee-packaging-mockups'],
  ['药品', 'medicine-packaging-dielines', 'medicine-box-mockups'],
  ['糖果', 'candy-box-dielines', 'candy-packaging-mockups'],
]

const rows = []
for (const [name, dKey, mKey] of pairs) {
  console.log(`\n=== ${name} ===`)
  const D = await fetchAll('dielineNameKey', dKey)
  const M = await fetchAll('mockupNameKey', mKey)
  const { inter, onlyA, onlyB } = intersect(D.unique, M.unique)
  const sampleInter = inter.slice(0, 10).map((n) => {
    const x = D.unique.get(n)
    return {
      num: n,
      name: x.name,
      dielineUrl: `https://www.pacdora.cn/dielines-detail/${x.nameKey}`,
      mockupUrl: `https://www.pacdora.cn/mockup-detail/${x.mockupNameKey}`,
    }
  })
  const row = {
    name,
    dKey,
    mKey,
    dielineTotal: D.apiTotal,
    dielineUnique: D.unique.size,
    mockupTotal: M.apiTotal,
    mockupUnique: M.unique.size,
    intersection: inter.length,
    onlyDieline: onlyA.length,
    onlyMockup: onlyB.length,
    overlapPctOfDieline: D.unique.size
      ? Number(((inter.length / D.unique.size) * 100).toFixed(1))
      : 0,
    overlapPctOfMockup: M.unique.size
      ? Number(((inter.length / M.unique.size) * 100).toFixed(1))
      : 0,
    sampleInter,
    sampleOnlyD: onlyA.slice(0, 10).map((n) => ({ num: n, name: D.unique.get(n)?.name })),
    sampleOnlyM: onlyB.slice(0, 10).map((n) => ({ num: n, name: M.unique.get(n)?.name })),
  }
  rows.push(row)
  console.log(
    `${name}: D=${row.dielineUnique}/${row.dielineTotal} M=${row.mockupUnique}/${row.mockupTotal} ∩=${row.intersection} (${row.overlapPctOfDieline}% of D, ${row.overlapPctOfMockup}% of M)`,
  )
}

console.log('\n=== box-mockups overall pairing ===')
const boxes = await fetchAll('mockupNameKey', 'box-mockups')
let paired = 0
let dielineKey = 0
for (const x of boxes.unique.values()) {
  if (x.nameKey && x.mockupNameKey) paired += 1
  if (String(x.nameKey || '').includes('dieline')) dielineKey += 1
}

const summary = {
  method: 'GET /api/v2/models?pageSize=&current=&dielineNameKey|mockupNameKey=',
  pairs: rows,
  boxMockups: {
    total: boxes.apiTotal,
    unique: boxes.unique.size,
    pairedKeys: paired,
    nameKeyContainsDieline: dielineKey,
  },
}

writeFileSync('dieline_mockup_compare_final.json', JSON.stringify(summary, null, 2))
console.log('\nWrote dieline_mockup_compare_final.json')
console.log(JSON.stringify(rows.map((r) => ({
  name: r.name,
  D: r.dielineUnique,
  M: r.mockupUnique,
  inter: r.intersection,
  pctD: r.overlapPctOfDieline,
  pctM: r.overlapPctOfMockup,
})), null, 2))
