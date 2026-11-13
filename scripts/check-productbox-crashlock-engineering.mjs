/**
 * productbox-crashlock engineering-domain regression (phase7 deepen).
 * Structural truth: 61 Cutting + 14 Creasing (not raw 63).
 */
import { createKnife } from '../src/knife.js'
import { geometryDocumentFromKnife } from '../packages/geometry-schema/geometryDocument.mjs'
import {
  checkEngineeringDomain,
  loadEngineeringDomain,
} from '../packages/geometry-schema/engineeringDomain.mjs'
import { toSvgDieline, toDxf } from '../src/exportDieline.js'
import { generateCrashlockWithOutline } from '../packages/crashlock-engine/index.mjs'

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

const TEMPLATE = 'productbox-crashlock'
const STRUCTURAL_CUTTING = 61
const STRUCTURAL_CREASING = 14
const domain = loadEngineeringDomain(TEMPLATE)
if (!domain) fail(`missing ${TEMPLATE} engineering domain`)
const anchors = domain.anchors || []
if (anchors.length < 3) fail('domain must declare >=3 anchors')

function maxCuttingDelta(a, b) {
  let max = 0
  const n = Math.min(a.cutting?.length || 0, b.cutting?.length || 0)
  for (let i = 0; i < n; i++) {
    const s0 = a.cutting[i]
    const s1 = b.cutting[i]
    for (const k of ['p0', 'p1', 'c0', 'c1']) {
      if (!s0[k] || !s1[k]) continue
      const d = Math.hypot(s0[k].x - s1[k].x, s0[k].y - s1[k].y)
      if (d > max) max = d
    }
  }
  return max
}

for (const a of anchors) {
  const input = {
    templateId: TEMPLATE,
    lengthMm: a.lengthMm,
    widthMm: a.widthMm,
    heightMm: a.heightMm,
    thicknessMm: a.thicknessMm,
    bleedMm: 3,
    sizeMode: 'inner',
    fluteDirection: 'L',
    materialId: 'kraft',
    params: {},
    unitConfidence: 'trusted',
    source: 'parametric',
  }
  const domainCheck = checkEngineeringDomain(input, domain)
  if (!domainCheck.ok) fail(`anchor ${a.lengthMm}x${a.widthMm}x${a.heightMm} outside domain`)

  const knife = createKnife({
    templateId: TEMPLATE,
    length: a.lengthMm,
    width: a.widthMm,
    height: a.heightMm,
    thickness: a.thicknessMm,
    bleed: 3,
    sizeMode: 'inner',
    fluteDirection: 'L',
    materialId: 'kraft',
    strict: true,
  })
  if (!knife.validation?.ok) fail(`anchor validation.ok=false @ ${a.lengthMm}x${a.widthMm}x${a.heightMm}`)
  if (knife.meta?.cutApprox || knife.meta?.bleedApprox) {
    fail(`anchor approx geometry @ ${a.lengthMm}x${a.widthMm}x${a.heightMm}`)
  }
  if (knife.manufacturingReady) fail('manufacturingReady must be false')
  if (knife.meta?.structuralCutting !== STRUCTURAL_CUTTING) {
    fail(`structuralCutting expected ${STRUCTURAL_CUTTING} got ${knife.meta?.structuralCutting}`)
  }
  if (knife.meta?.structuralCreasing !== STRUCTURAL_CREASING) {
    fail(`structuralCreasing expected ${STRUCTURAL_CREASING} got ${knife.meta?.structuralCreasing}`)
  }
  const structuralCheck = (knife.validation?.checks || []).find((c) => c.id === 'structural-count')
  if (!structuralCheck?.ok) fail('structural-count check failed')

  const docA = geometryDocumentFromKnife(knife, input)
  const docB = geometryDocumentFromKnife(knife, input)
  if (docA.canonicalHash !== docB.canonicalHash) fail('hash unstable')
  if (!String(docA.canonicalHash).startsWith('g1:')) fail('hash missing g1:')

  const svg = toSvgDieline(knife, { qualityTier: 'engineering' })
  if (!/width="[\d.]+mm"/i.test(svg)) fail('engineering SVG missing physical width mm')
  if (!/ENGINEERING CANDIDATE/i.test(svg)) fail('missing ENGINEERING CANDIDATE disclaimer')
  const dxf = toDxf(knife)
  if (!dxf.includes('\n70\n4\n')) fail('DXF INSUNITS not mm')
  console.log(
    `ok anchor ${a.lengthMm}x${a.widthMm}x${a.heightMm}@${a.thicknessMm} hash=${docA.canonicalHash.slice(0, 12)}… struct=${knife.meta.structuralCutting}/${knife.meta.structuralCreasing}`,
  )
}

// Identity path T=0 / kerf=0: stable hash
{
  const input0 = {
    templateId: TEMPLATE,
    lengthMm: 100,
    widthMm: 80,
    heightMm: 80,
    thicknessMm: 0,
    bleedMm: 3,
    sizeMode: 'inner',
    fluteDirection: 'L',
    materialId: 'kraft',
    unitConfidence: 'trusted',
    source: 'parametric',
  }
  const k0a = createKnife({
    templateId: TEMPLATE,
    length: 100,
    width: 80,
    height: 80,
    thickness: 0,
    bleed: 3,
    strict: true,
  })
  const k0b = createKnife({
    templateId: TEMPLATE,
    length: 100,
    width: 80,
    height: 80,
    thickness: 0,
    bleed: 3,
    strict: true,
  })
  if (k0a.meta?.hooksActive) fail('T=0 should be identity hooks')
  const h0a = geometryDocumentFromKnife(k0a, input0).canonicalHash
  const h0b = geometryDocumentFromKnife(k0b, input0).canonicalHash
  if (h0a !== h0b) fail('T=0 hash unstable')
  console.log('ok T=0 identity hash stable')
}

// Hooks displace geometry vs T=0 (unvalidated)
{
  const a = generateCrashlockWithOutline({ L: 100, W: 80, H: 80, thicknessMm: 0, kerfMm: 0 })
  const b = generateCrashlockWithOutline({ L: 100, W: 80, H: 80, thicknessMm: 0.6, kerfMm: 0 })
  if (a.cutting.length !== STRUCTURAL_CUTTING || b.cutting.length !== STRUCTURAL_CUTTING) {
    fail('hook path must keep structural cutting=61')
  }
  const delta = maxCuttingDelta(a, b)
  if (!(delta > 0.1)) fail(`expected thickness hooks to displace geometry, delta=${delta}`)
  if (!(b.gaps || []).includes('material_hooks_applied_unvalidated')) {
    fail('expected material_hooks_applied_unvalidated gap when T>0')
  }
  console.log(`ok thickness hooks displace geometry deltaUu=${delta.toFixed(3)}`)
}

const outside = checkEngineeringDomain(
  {
    templateId: TEMPLATE,
    lengthMm: 40,
    widthMm: 40,
    heightMm: 50,
    thicknessMm: 0.6,
    sizeMode: 'inner',
    materialId: 'kraft',
    fluteDirection: 'L',
  },
  domain,
)
if (outside.ok) fail('expected outside-domain rejection')
console.log('ok outside-domain rejected')

const noDomain = checkEngineeringDomain({
  templateId: 'fefco-0427',
  lengthMm: 250,
  widthMm: 180,
  heightMm: 60,
  thicknessMm: 1.5,
  sizeMode: 'inner',
  materialId: 'kraft',
  fluteDirection: 'L',
})
if (noDomain.ok) fail('expected unregistered template rejected')
console.log('ok unregistered template rejected')

console.log('note: holdout_full_crashlock_topology stays blocked (raw 63 has export zero-length artifacts; structural=61)')
console.log('check-productbox-crashlock-engineering: all passed')
