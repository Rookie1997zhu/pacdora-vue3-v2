/**
 * Material profiles for workbench (示意补偿，calibrated 均为 false).
 * engineMaterialId maps to kraft|white|blue used by 3D / engineering domain.
 */

/** @typedef {'kraft'|'art'|'corrugated'} MaterialFamily */
/** @typedef {'kraft'|'white'|'blue'} EngineMaterialId */

/**
 * @typedef {object} MaterialProfile
 * @property {string} id
 * @property {string} labelZh
 * @property {string} labelKo
 * @property {MaterialFamily} family
 * @property {string|null} flute
 * @property {{default:number,min:number,max:number,step:number}} thickness
 * @property {EngineMaterialId} engineMaterialId
 * @property {boolean} calibrated
 * @property {string} profileVersion
 * @property {number} bleedDefaultMm
 * @property {string[]} riskTags
 */

/** @type {MaterialProfile[]} */
export const MATERIAL_PROFILES = Object.freeze([
  {
    id: 'kraft-150',
    labelZh: '牛皮纸 150g',
    labelKo: '크라프트 150g',
    family: 'kraft',
    flute: null,
    thickness: { default: 0.22, min: 0.2, max: 0.28, step: 0.02 },
    engineMaterialId: 'kraft',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: ['thin_board'],
  },
  {
    id: 'kraft-250',
    labelZh: '牛皮纸 250g',
    labelKo: '크라프트 250g',
    family: 'kraft',
    flute: null,
    thickness: { default: 0.35, min: 0.28, max: 0.42, step: 0.02 },
    engineMaterialId: 'kraft',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: [],
  },
  {
    id: 'kraft-350',
    labelZh: '牛皮纸 350g',
    labelKo: '크라프트 350g',
    family: 'kraft',
    flute: null,
    thickness: { default: 0.48, min: 0.4, max: 0.55, step: 0.02 },
    engineMaterialId: 'kraft',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: [],
  },
  {
    id: 'art-150',
    labelZh: '铜版/艺术纸 150g',
    labelKo: '아트지 150g',
    family: 'art',
    flute: null,
    thickness: { default: 0.18, min: 0.15, max: 0.25, step: 0.02 },
    engineMaterialId: 'white',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: ['thin_board', 'art_paper'],
  },
  {
    id: 'art-250',
    labelZh: '铜版/艺术纸 250g',
    labelKo: '아트지 250g',
    family: 'art',
    flute: null,
    thickness: { default: 0.3, min: 0.25, max: 0.38, step: 0.02 },
    engineMaterialId: 'white',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: ['art_paper'],
  },
  {
    id: 'art-350',
    labelZh: '铜版/艺术纸 350g',
    labelKo: '아트지 350g',
    family: 'art',
    flute: null,
    thickness: { default: 0.42, min: 0.35, max: 0.5, step: 0.02 },
    engineMaterialId: 'white',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: ['art_paper'],
  },
  {
    id: 'flute-e',
    labelZh: 'E 楞瓦楞（三层）',
    labelKo: 'E골 골판지',
    family: 'corrugated',
    flute: 'E',
    thickness: { default: 1.5, min: 1.1, max: 2.0, step: 0.1 },
    engineMaterialId: 'kraft',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 5,
    riskTags: ['flute'],
  },
  {
    id: 'flute-b',
    labelZh: 'B 楞瓦楞（三层）',
    labelKo: 'B골 골판지',
    family: 'corrugated',
    flute: 'B',
    thickness: { default: 3.0, min: 2.5, max: 3.5, step: 0.1 },
    engineMaterialId: 'kraft',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 5,
    riskTags: ['flute'],
  },
  {
    id: 'white-board',
    labelZh: '白卡纸',
    labelKo: '백판지',
    family: 'art',
    flute: null,
    thickness: { default: 0.4, min: 0.3, max: 0.55, step: 0.05 },
    engineMaterialId: 'white',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: [],
  },
  {
    id: 'blue-board',
    labelZh: '蓝卡纸',
    labelKo: '블루보드',
    family: 'art',
    flute: null,
    thickness: { default: 0.4, min: 0.3, max: 0.55, step: 0.05 },
    engineMaterialId: 'blue',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: [],
  },
  // Legacy engine ids as profiles (preview / old documents)
  {
    id: 'kraft',
    labelZh: '牛皮（引擎）',
    labelKo: '크라프트',
    family: 'kraft',
    flute: null,
    thickness: { default: 1.5, min: 0.2, max: 5, step: 0.1 },
    engineMaterialId: 'kraft',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: [],
  },
  {
    id: 'white',
    labelZh: '白卡（引擎）',
    labelKo: '화이트',
    family: 'art',
    flute: null,
    thickness: { default: 0.5, min: 0.2, max: 2, step: 0.05 },
    engineMaterialId: 'white',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: [],
  },
  {
    id: 'blue',
    labelZh: '蓝卡（引擎）',
    labelKo: '블루',
    family: 'art',
    flute: null,
    thickness: { default: 0.5, min: 0.2, max: 2, step: 0.05 },
    engineMaterialId: 'blue',
    calibrated: false,
    profileVersion: '0.1',
    bleedDefaultMm: 3,
    riskTags: [],
  },
])

const BY_ID = new Map(MATERIAL_PROFILES.map((p) => [p.id, p]))

/** @param {string} id */
export function getMaterialProfile(id) {
  return BY_ID.get(String(id || '').trim()) || null
}

/**
 * Map any material / profile id to kraft|white|blue.
 * @param {string} id
 * @returns {EngineMaterialId}
 */
export function resolveEngineMaterialId(id) {
  const profile = getMaterialProfile(id)
  if (profile) return profile.engineMaterialId
  const raw = String(id || 'kraft')
  if (raw === 'white' || raw === 'blue' || raw === 'kraft') return raw
  return 'kraft'
}

export function listMaterialProfiles({ includeLegacy = false } = {}) {
  if (includeLegacy) return [...MATERIAL_PROFILES]
  return MATERIAL_PROFILES.filter((p) => !['kraft', 'white', 'blue'].includes(p.id))
}
