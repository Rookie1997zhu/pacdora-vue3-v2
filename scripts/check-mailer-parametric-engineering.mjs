/**
 * mailer-parametric-demo engineering-domain regression.
 */
import { createKnife } from '../src/knife.js'
import { geometryDocumentFromKnife } from '../packages/geometry-schema/geometryDocument.mjs'
import {
  checkEngineeringDomain,
  loadEngineeringDomain,
} from '../packages/geometry-schema/engineeringDomain.mjs'
import { toSvgDieline, toDxf } from '../src/exportDieline.js'

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

const TEMPLATE = 'mailer-parametric-demo'
const domain = loadEngineeringDomain(TEMPLATE)
if (!domain) fail(`missing ${TEMPLATE} engineering domain`)
const anchors = domain.anchors || []
if (anchors.length < 3) fail('domain must declare >=3 anchors')

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
    `ok anchor ${a.lengthMm}x${a.widthMm}x${a.heightMm}@${a.thicknessMm} hash=${docA.canonicalHash.slice(0, 12)}…`,
  )
}

const outside = checkEngineeringDomain(
  {
    templateId: TEMPLATE,
    lengthMm: 100,
    widthMm: 80,
    heightMm: 30,
    thicknessMm: 1.5,
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

console.log('check-mailer-parametric-engineering: all passed')
