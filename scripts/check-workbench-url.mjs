import assert from 'node:assert/strict'
import { decodeWorkbenchUrl, encodeWorkbenchUrl } from '../src/features/workbench/lib/urlCodec.mjs'

const defaults = {
  lengthMm: 315,
  widthMm: 202,
  heightMm: 62,
  thicknessMm: 1.5,
  sizeMode: 'manufacturing',
  materialId: 'flute-e',
  fluteDirection: 'L',
  bleedInputMm: 3,
  advanced: {},
}

// Defaults → empty-ish URL (only v=1)
const empty = encodeWorkbenchUrl(defaults, defaults)
assert.equal(empty.get('l'), null)
assert.equal(empty.get('v'), '1')

const params = {
  ...defaults,
  lengthMm: 330,
  sizeMode: 'inner',
  advanced: { N: 81, K: 2 },
  displayUnit: 'in',
}
const sp = encodeWorkbenchUrl(params, defaults)
assert.equal(sp.get('l'), '330')
assert.equal(sp.get('sm'), 'id')
assert.ok(sp.get('p')?.includes('N:81'))
assert.equal(sp.get('u'), 'in')

const round = decodeWorkbenchUrl(sp, { defaults })
assert.equal(round.lengthMm, 330)
assert.equal(round.sizeMode, 'inner')
assert.equal(round.advanced.N, 81)
assert.equal(round.displayUnit, 'in')

// Malicious / unknown keys discarded
const bad = decodeWorkbenchUrl('l=abc&m=../../x&p=1bad:9,N:10,$x:3&sm=xx&b=999', {
  defaults,
  limits: { length: [80, 1200], bleed: [0, 10] },
})
assert.equal(bad.lengthMm, defaults.lengthMm)
assert.equal(bad.materialId, defaults.materialId)
assert.equal(bad.advanced.N, 10)
assert.equal(bad.advanced['1bad'], undefined)
assert.equal(bad.advanced['$x'], undefined)
assert.equal(bad.sizeMode, defaults.sizeMode)
assert.equal(bad.bleedInputMm, 10)

console.log('check-workbench-url: ok')
