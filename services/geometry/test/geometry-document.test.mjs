import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {dirname, join} from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const {createKnife} = await import(pathToFileURL(join(root, 'src', 'knife.js')).href)
const {
  geometryDocumentFromKnife,
  canonicalHash,
  HASH_PREFIX,
} = await import(pathToFileURL(join(root, 'packages', 'geometry-schema', 'geometryDocument.mjs')).href)
const {
  toSvgDieline,
} = await import(pathToFileURL(join(root, 'src', 'exportDieline.js')).href)
const {
  parseSvgLengthToMm,
  derivePackativeUnitProvenance,
} = await import(pathToFileURL(join(root, 'src', 'packative', 'packativeGeomKnife.js')).href)

function baseInput(overrides = {}) {
  return {
    templateId: 'mailer-parametric-demo',
    lengthMm: 300,
    widthMm: 200,
    heightMm: 50,
    thicknessMm: 1.5,
    bleedMm: 3,
    sizeMode: 'inner',
    fluteDirection: 'L',
    materialId: 'kraft',
    params: {},
    unitConfidence: 'trusted',
    source: 'parametric',
    ...overrides,
  }
}

test('canonical hash stable for same knife+input and changes with params', () => {
  const input = baseInput()
  const knife = createKnife({
    templateId: input.templateId,
    length: input.lengthMm,
    width: input.widthMm,
    height: input.heightMm,
    thickness: input.thicknessMm,
    bleed: input.bleedMm,
    sizeMode: input.sizeMode,
    fluteDirection: input.fluteDirection,
    materialId: input.materialId,
    params: input.params,
    strict: true,
  })
  const docA = geometryDocumentFromKnife(knife, input)
  const docB = geometryDocumentFromKnife(knife, input)
  assert.equal(docA.canonicalHash, docB.canonicalHash)
  assert.ok(docA.canonicalHash.startsWith(HASH_PREFIX))
  assert.equal(docA.canonicalHash, canonicalHash({...docA, canonicalHash: undefined}))

  const input2 = baseInput({fluteDirection: 'W', bleedMm: 5})
  const knife2 = createKnife({
    templateId: input2.templateId,
    length: input2.lengthMm,
    width: input2.widthMm,
    height: input2.heightMm,
    thickness: input2.thicknessMm,
    bleed: input2.bleedMm,
    sizeMode: input2.sizeMode,
    fluteDirection: input2.fluteDirection,
    materialId: input2.materialId,
    params: input2.params,
    strict: true,
  })
  const docC = geometryDocumentFromKnife(knife2, input2)
  assert.notEqual(docA.canonicalHash, docC.canonicalHash)
})

test('strict createKnife rejects unknown template and out-of-range', () => {
  assert.throws(
    () => createKnife({templateId: 'no-such-template', length: 100, width: 80, height: 50, strict: true}),
    (e) => e.code === 'UNKNOWN_TEMPLATE',
  )
  assert.throws(
    () =>
      createKnife({
        templateId: 'mailer-parametric-demo',
        length: 1,
        width: 1,
        height: 1,
        thickness: 1.5,
        strict: true,
      }),
    (e) => e.code === 'OUT_OF_RANGE',
  )
})

test('manufacturing SVG declares physical mm; proof SVG does not', () => {
  const knife = createKnife({
    templateId: 'mailer-parametric-demo',
    length: 300,
    width: 200,
    height: 50,
    thickness: 1.5,
    bleed: 3,
  })
  const proof = toSvgDieline(knife, {qualityTier: 'vector_proof'})
  const eng = toSvgDieline(knife, {qualityTier: 'manufacturing'})
  assert.ok(!/width="[\d.]+mm"/i.test(proof))
  assert.ok(/width="[\d.]+mm"/i.test(eng))
  assert.ok(/height="[\d.]+mm"/i.test(eng))
  assert.ok(/PROOF ONLY/i.test(proof))
  assert.ok(/ENGINEERING SVG/i.test(eng))
})

test('packative unit provenance requires absolute width/height', () => {
  assert.equal(parseSvgLengthToMm('100mm'), 100)
  assert.equal(parseSvgLengthToMm('10cm'), 100)
  assert.equal(parseSvgLengthToMm('96'), null)
  assert.equal(parseSvgLengthToMm('96px'), null)
  const untrusted = derivePackativeUnitProvenance({
    viewBox: [0, 0, 100, 50],
    widthAttr: '100',
    heightAttr: '50',
  })
  assert.equal(untrusted.unitConfidence, 'untrusted')
  const trusted = derivePackativeUnitProvenance({
    viewBox: [0, 0, 100, 50],
    widthAttr: '100mm',
    heightAttr: '50mm',
  })
  assert.equal(trusted.unitConfidence, 'trusted')
  assert.equal(trusted.mmPerUnit, 1)
})
