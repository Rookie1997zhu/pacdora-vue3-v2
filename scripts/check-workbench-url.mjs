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

// Keys missing from the URL fall back to the defaults (the encoder omits unchanged values).
// Regression: Number(null) === 0 used to turn every omitted dimension into 0 after a reload.
{
  const d={lengthMm:119.4,widthMm:59.4,heightMm:158.4,thicknessMm:.5,bleedInputMm:3,materialId:'white',sizeMode:'inner'}
  const got=decodeWorkbenchUrl('?l=150&v=1',{defaults:d})
  if(got.lengthMm!==150||got.widthMm!==59.4||got.heightMm!==158.4||got.thicknessMm!==.5||got.bleedInputMm!==3){
    throw new Error('partial URL must keep defaults for omitted keys: '+JSON.stringify(got))
  }
  if(decodeWorkbenchUrl('?b=0&v=1',{defaults:d}).bleedInputMm!==0)throw new Error('explicit 0 must be kept')
}
console.log('check-workbench-url: ok')
