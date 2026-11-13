/**
 * FEFCO 0201 engineering-domain regression (software-side trusted dieline).
 * Fail loudly; never fake Passed.
 */
import { createKnife } from '../src/knife.js'
import {
  geometryDocumentFromKnife,
} from '../packages/geometry-schema/geometryDocument.mjs'
import {
  checkEngineeringDomain,
  loadEngineeringDomain,
} from '../packages/geometry-schema/engineeringDomain.mjs'
import { toSvgDieline, toDxf } from '../src/exportDieline.js'
import {
  fefco0201ClosureDims,
  fefco0201FilletRadius,
} from '../src/templates/fefco0201.js'

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

const domain = loadEngineeringDomain('fefco-0201')
if (!domain) fail('missing fefco-0201 engineering domain')
const anchors = domain.anchors || []
if (anchors.length < 3) fail('domain must declare >=3 anchors')

const flapNames = [
  'frontTop', 'rightTop', 'backTop', 'leftTop',
  'frontBottom', 'rightBottom', 'backBottom', 'leftBottom',
]

for (const a of anchors) {
  const input = {
    templateId: 'fefco-0201',
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

  const T = a.thicknessMm
  const { slot, meetGap, flapH } = fefco0201ClosureDims({
    innerWidth: a.widthMm,
    T,
  })
  if (slot < 2 - 1e-6 || slot > T + 0.5 + 1e-6) {
    fail(`slot ${slot} out of [2, T+0.5] @ T=${T}`)
  }
  const cover = 2 * flapH + meetGap
  if (Math.abs(cover - a.widthMm) > 0.5) {
    fail(`2*flapH+meetGap=${cover} != inner.W=${a.widthMm} (tol 0.5)`)
  }

  const knife = createKnife({
    templateId: 'fefco-0201',
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
  if (knife.manufacturingReady) fail('manufacturingReady must stay false')

  const expectR = fefco0201FilletRadius({
    T,
    edgeMm: Math.min(
      (knife.faces.find((f) => f.name === 'frontTop')?.w || flapH),
      flapH,
    ),
  })
  if (expectR < 5) fail(`fillet radius too small for visibility: ${expectR}`)

  for (const name of flapNames) {
    const face = (knife.faces || []).find((f) => f.name === name)
    if (!face) fail(`missing flap face ${name}`)
    if (Math.abs(face.h - flapH) > 0.05) {
      fail(`${name}.h=${face.h} != flapH=${flapH}`)
    }
    if (!Array.isArray(face.outline) || face.outline.length < 5) {
      fail(`${name} missing filleted outline`)
    }
  }
  const glue = (knife.faces || []).find((f) => f.name === 'glueFlap')
  if (!glue || !Array.isArray(glue.outline) || glue.outline.length < 5) {
    fail('glueFlap missing filleted outline')
  }

  const docA = geometryDocumentFromKnife(knife, input)
  const docB = geometryDocumentFromKnife(knife, input)
  if (docA.canonicalHash !== docB.canonicalHash) fail('hash unstable for same input')
  if (!String(docA.canonicalHash).startsWith('g1:')) fail('hash missing g1: prefix')

  const svg = toSvgDieline(knife, { qualityTier: 'engineering' })
  if (!/width="[\d.]+mm"/i.test(svg)) fail('engineering SVG missing physical width mm')
  if (!/ENGINEERING CANDIDATE/i.test(svg)) fail('engineering SVG missing candidate disclaimer')
  const dxf = toDxf(knife)
  if (!/\$INSUNITS[\s\S]*?\n70\n4\n/.test(dxf) && !dxf.includes('$INSUNITS')) {
    fail('DXF missing INSUNITS')
  }
  if (!dxf.includes('\n70\n4\n')) fail('DXF INSUNITS not mm (70/4)')
  console.log(
    `ok anchor ${a.lengthMm}x${a.widthMm}x${a.heightMm}@${a.thicknessMm} slot=${slot} flapH=${flapH} meetGap=${meetGap} hash=${docA.canonicalHash.slice(0, 12)}…`,
  )
}

// Outside domain must fail domain check
const outside = checkEngineeringDomain(
  {
    templateId: 'fefco-0201',
    lengthMm: 100,
    widthMm: 80,
    heightMm: 50,
    thicknessMm: 3,
    sizeMode: 'inner',
    materialId: 'kraft',
    fluteDirection: 'L',
  },
  domain,
)
if (outside.ok) fail('expected outside-domain rejection for 100x80x50')
console.log('ok outside-domain rejected')

const wrongTemplate = checkEngineeringDomain(
  {
    templateId: 'mailer-parametric-demo',
    lengthMm: 300,
    widthMm: 200,
    heightMm: 150,
    thicknessMm: 3,
    sizeMode: 'inner',
    materialId: 'kraft',
    fluteDirection: 'L',
  },
  domain,
)
if (wrongTemplate.ok) fail('expected non-fefco template rejected for engineering domain')
console.log('ok non-fefco template rejected')

console.log('check-fefco0201-engineering: all passed')
