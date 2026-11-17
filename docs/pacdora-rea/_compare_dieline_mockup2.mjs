import { writeFileSync } from 'node:fs'

async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

async function fetchAll(param, key, pageSize = 100) {
  const byNum = new Map()
  let page = 1
  let apiTotal = null
  for (;;) {
    const url =
      `https://www.pacdora.cn/api/v2/models?page=${page}&pageSize=${pageSize}` +
      `&${param}=${encodeURIComponent(key)}`
    const j = await getJson(url)
    if (apiTotal == null) apiTotal = Number(j.total || 0)
    const batch = j.data || []
    if (!batch.length) break
    for (const x of batch) byNum.set(String(x.num), x)
    console.log(`  ${param}=${key} page=${page} got=${batch.length} unique=${byNum.size} total=${apiTotal}`)
    if (byNum.size >= apiTotal || batch.length < pageSize) break
    page += 1
    if (page > 100) break
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
]

const rows = []
for (const [name, dKey, mKey] of pairs) {
  console.log(`\n=== ${name} ===`)
  const D = await fetchAll('dielineNameKey', dKey)
  const M = await fetchAll('mockupNameKey', mKey)
  const { inter, onlyA, onlyB } = intersect(D.unique, M.unique)
  const sampleInter = inter.slice(0, 8).map((n) => {
    const x = D.unique.get(n)
    return { num: n, name: x.name, nameKey: x.nameKey, mockupNameKey: x.mockupNameKey }
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
    sampleOnlyD: onlyA.slice(0, 8),
    sampleOnlyM: onlyB.slice(0, 8),
  }
  rows.push(row)
  console.log(
    `${name}: D=${row.dielineUnique}/${row.dielineTotal} M=${row.mockupUnique}/${row.mockupTotal} ∩=${row.intersection} (${row.overlapPctOfDieline}% of D, ${row.overlapPctOfMockup}% of M)`,
  )
}

console.log('\n=== box-mockups vs gift-box-dielines ===')
const boxes = await fetchAll('mockupNameKey', 'box-mockups')
const giftD = await fetchAll('dielineNameKey', 'gift-box-dielines')
const boxVsGift = intersect(giftD.unique, boxes.unique)
console.log(
  `giftD ∩ boxM = ${boxVsGift.inter.length} / giftD ${giftD.unique.size} / boxM ${boxes.unique.size}`,
)

// Model-level pairing check on full box mockups
let paired = 0
let sameNumSuffix = 0
for (const x of boxes.unique.values()) {
  if (x.nameKey && x.mockupNameKey) paired += 1
  const dn = String(x.nameKey || '').match(/(\d+)$/)
  const mn = String(x.mockupNameKey || '').match(/(\d+)$/)
  if (dn && mn && dn[1] === mn[1] && dn[1] === String(x.num)) sameNumSuffix += 1
}

const summary = {
  conclusion:
    'Dielines and mockups share one model catalog (same num). Entry routes differ by dielineNameKey vs mockupNameKey; category trees differ (By Uses vs product form). Overlap is partial at category level.',
  pairs: rows,
  boxMockups: {
    total: boxes.apiTotal,
    unique: boxes.unique.size,
    pairedKeys: paired,
    sameNumSuffix,
    giftDielineIntersection: boxVsGift.inter.length,
  },
}

writeFileSync('dieline_mockup_compare_final.json', JSON.stringify(summary, null, 2))
console.log('\nWrote dieline_mockup_compare_final.json')
