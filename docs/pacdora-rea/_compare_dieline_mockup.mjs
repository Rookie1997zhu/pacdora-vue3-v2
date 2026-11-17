import { writeFileSync } from 'node:fs'

async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

async function fetchAllByKey(param, key, pageSize = 100) {
  const items = []
  let page = 1
  let total = Infinity
  while (items.length < total) {
    const url =
      `https://www.pacdora.cn/api/v2/models?page=${page}` +
      `&pageSize=${pageSize}&${param}=${encodeURIComponent(key)}`
    const j = await getJson(url)
    const batch = j.data || []
    total = Number(j.total ?? batch.length)
    items.push(...batch)
    if (!batch.length) break
    page += 1
    if (page > 80) break
  }
  return { total, items }
}

function summarize(items) {
  const nums = new Set(items.map((x) => String(x.num)))
  const withKnife = items.filter((x) => !!x.knife).length
  const withDielineKey = items.filter(
    (x) => x.nameKey && String(x.nameKey).includes('dieline'),
  ).length
  const withMockupKey = items.filter((x) => !!x.mockupNameKey).length
  const both = items.filter((x) => x.nameKey && x.mockupNameKey).length
  return { n: items.length, nums, withKnife, withDielineKey, withMockupKey, both }
}

const ctree = await getJson('https://www.pacdora.cn/api/v2/models/ctree')
const ctreeM = await getJson('https://www.pacdora.cn/api/v2/models/ctree?mockup=true')

const dielineCats = (ctree.data?.[0]?.children || []).map((c) => ({
  id: c.id,
  name: c.name,
  count: c.count,
  dielineNameKey: c.dielineNameKey,
  mockupNameKey: c.mockupNameKey,
}))

const mockupTop = (ctreeM.data || []).map((c) => ({
  id: c.id,
  name: c.name,
  count: c.count,
  mockupNameKey: c.mockupNameKey,
  dielineNameKey: c.dielineNameKey,
  children: (c.children || []).map((ch) => ({
    id: ch.id,
    name: ch.name,
    count: ch.count,
    mockupNameKey: ch.mockupNameKey,
    dielineNameKey: ch.dielineNameKey,
  })),
}))

console.log('=== Dielines By Uses categories ===')
for (const c of dielineCats) {
  console.log(
    `${c.id}\t${c.count}\t${c.name}\td=${c.dielineNameKey || '-'}\tm=${c.mockupNameKey || '-'}`,
  )
}

console.log('\n=== Mockups top categories ===')
for (const c of mockupTop) {
  console.log(
    `${c.id}\t${c.count}\t${c.name}\tm=${c.mockupNameKey || '-'}\td=${c.dielineNameKey || '-'}\tchildren=${c.children.length}`,
  )
}

const pairs = dielineCats.filter((c) => c.dielineNameKey && c.mockupNameKey)
console.log(`\n=== Pairwise compare (${pairs.length} categories with both keys) ===`)

const report = { dielineCats, mockupTop, pairs: [] }

for (const p of pairs) {
  const [dRes, mRes] = await Promise.all([
    fetchAllByKey('dielineNameKey', p.dielineNameKey),
    fetchAllByKey('mockupNameKey', p.mockupNameKey),
  ])
  const d = summarize(dRes.items)
  const m = summarize(mRes.items)
  const inter = [...d.nums].filter((n) => m.nums.has(n))
  const onlyD = [...d.nums].filter((n) => !m.nums.has(n))
  const onlyM = [...m.nums].filter((n) => !d.nums.has(n))
  const row = {
    name: p.name,
    dielineNameKey: p.dielineNameKey,
    mockupNameKey: p.mockupNameKey,
    catCount: p.count,
    dielineFetched: d.n,
    mockupFetched: m.n,
    dielineApiTotal: dRes.total,
    mockupApiTotal: mRes.total,
    intersection: inter.length,
    onlyDieline: onlyD.length,
    onlyMockup: onlyM.length,
    sampleInter: inter.slice(0, 8),
    sampleOnlyD: onlyD.slice(0, 8),
    sampleOnlyM: onlyM.slice(0, 8),
    dielineKnifeRatio: `${d.withKnife}/${d.n}`,
    mockupKnifeRatio: `${m.withKnife}/${m.n}`,
  }
  report.pairs.push(row)
  console.log(
    `${p.name}: D=${d.n}/${dRes.total} M=${m.n}/${mRes.total} ∩=${inter.length} onlyD=${onlyD.length} onlyM=${onlyM.length} knifeD=${d.withKnife} knifeM=${m.withKnife}`,
  )
}

// Non-packaging mockup samples via child keys
const apparel = mockupTop.find((c) => c.name === '服装')
const device = mockupTop.find((c) => c.name === '设备')
for (const c of [apparel, device].filter(Boolean)) {
  const childKey = c.children?.[0]?.mockupNameKey || c.mockupNameKey
  if (!childKey) {
    console.log(`\nSkip ${c.name}: no mockupNameKey`)
    continue
  }
  const mRes = await fetchAllByKey('mockupNameKey', childKey)
  const s = summarize(mRes.items)
  console.log(
    `\nNon-pack sample ${c.name} key=${childKey}: fetched=${mRes.items.length}/${mRes.total} knife=${s.withKnife} bothKeys=${s.both}`,
  )
  report[`sample_${c.name}`] = {
    key: childKey,
    total: mRes.total,
    n: mRes.items.length,
    knife: s.withKnife,
    both: s.both,
    sample: mRes.items.slice(0, 5).map((x) => ({
      num: x.num,
      name: x.name,
      knife: !!x.knife,
      nameKey: x.nameKey,
      mockupNameKey: x.mockupNameKey,
    })),
  }
}

// Overall first 1000 models
const all = []
for (let page = 1; page <= 10; page++) {
  const j = await getJson(`https://www.pacdora.cn/api/v2/models?page=${page}&pageSize=100`)
  all.push(...(j.data || []))
}
const o = summarize(all)
console.log(
  `\n=== Overall first ${all.length}/5972 === knife=${o.withKnife} bothKeys=${o.both} dielineKey=${o.withDielineKey} mockupKey=${o.withMockupKey}`,
)
const noMockup = all.filter((x) => !x.mockupNameKey)
const noDieline = all.filter((x) => !x.nameKey || !String(x.nameKey).includes('dieline'))
const noKnife = all.filter((x) => !x.knife)
console.log(
  'noMockupKey',
  noMockup.length,
  'noDielineKey',
  noDieline.length,
  'noKnife',
  noKnife.length,
)
console.log(
  'sample noKnife',
  noKnife.slice(0, 5).map((x) => `${x.num}:${x.name}`),
)
console.log(
  'sample noDielineKey',
  noDieline.slice(0, 5).map((x) => `${x.num}:${x.name}:${x.nameKey}`),
)

report.overallSample = {
  n: all.length,
  knife: o.withKnife,
  bothKeys: o.both,
  noMockupKey: noMockup.length,
  noDielineKey: noDieline.length,
  noKnife: noKnife.length,
}

writeFileSync('dieline_mockup_compare.json', JSON.stringify(report, null, 2))
console.log('\nWrote dieline_mockup_compare.json')
