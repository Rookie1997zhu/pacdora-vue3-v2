/**
 * 韩国常用纸种目录（预览用）。
 * mapMaterialId 仍落到引擎三材 kraft|white|blue；克重/瓦楞用目录表达。
 */

/** @typedef {'kraft'|'art'|'flute'} PaperFamily */
/** @typedef {'kraft'|'white'|'blue'} EngineMaterialId */

/**
 * @typedef {object} PaperEntry
 * @property {string} id
 * @property {string} labelKo
 * @property {string} labelZh
 * @property {PaperFamily} family
 * @property {number|null} gsm
 * @property {string|null} flute  e.g. 'E'|'B'
 * @property {number} thicknessMm
 * @property {EngineMaterialId} mapMaterialId
 * @property {string[]} riskTags
 */

/** @type {PaperEntry[]} */
export const PAPER_CATALOG = [
  {
    id: 'kraft-150',
    labelKo: '크라프트 150g',
    labelZh: '牛皮纸 150g',
    family: 'kraft',
    gsm: 150,
    flute: null,
    thicknessMm: 0.22,
    mapMaterialId: 'kraft',
    riskTags: ['thin_board'],
  },
  {
    id: 'kraft-250',
    labelKo: '크라프트 250g',
    labelZh: '牛皮纸 250g',
    family: 'kraft',
    gsm: 250,
    flute: null,
    thicknessMm: 0.35,
    mapMaterialId: 'kraft',
    riskTags: [],
  },
  {
    id: 'kraft-350',
    labelKo: '크라프트 350g',
    labelZh: '牛皮纸 350g',
    family: 'kraft',
    gsm: 350,
    flute: null,
    thicknessMm: 0.48,
    mapMaterialId: 'kraft',
    riskTags: [],
  },
  {
    id: 'art-150',
    labelKo: '아트지 150g',
    labelZh: '铜版/艺术纸 150g',
    family: 'art',
    gsm: 150,
    flute: null,
    thicknessMm: 0.18,
    mapMaterialId: 'white',
    riskTags: ['thin_board', 'art_paper'],
  },
  {
    id: 'art-250',
    labelKo: '아트지 250g',
    labelZh: '铜版/艺术纸 250g',
    family: 'art',
    gsm: 250,
    flute: null,
    thicknessMm: 0.3,
    mapMaterialId: 'white',
    riskTags: ['art_paper'],
  },
  {
    id: 'art-350',
    labelKo: '아트지 350g',
    labelZh: '铜版/艺术纸 350g',
    family: 'art',
    gsm: 350,
    flute: null,
    thicknessMm: 0.42,
    mapMaterialId: 'white',
    riskTags: ['art_paper'],
  },
  {
    id: 'flute-e',
    labelKo: 'E골 골판지',
    labelZh: 'E 楞瓦楞纸',
    family: 'flute',
    gsm: null,
    flute: 'E',
    thicknessMm: 1.5,
    mapMaterialId: 'kraft',
    riskTags: ['flute'],
  },
  {
    id: 'flute-b',
    labelKo: 'B골 골판지',
    labelZh: 'B 楞瓦楞纸',
    family: 'flute',
    gsm: null,
    flute: 'B',
    thicknessMm: 2.8,
    mapMaterialId: 'kraft',
    riskTags: ['flute'],
  },
  {
    id: 'white-board',
    labelKo: '백판지',
    labelZh: '白卡纸',
    family: 'art',
    gsm: 300,
    flute: null,
    thicknessMm: 0.4,
    mapMaterialId: 'white',
    riskTags: [],
  },
  {
    id: 'blue-board',
    labelKo: '블루보드',
    labelZh: '蓝卡纸',
    family: 'art',
    gsm: 300,
    flute: null,
    thicknessMm: 0.4,
    mapMaterialId: 'blue',
    riskTags: [],
  },
]

/** @param {string} id */
export function getPaperById(id) {
  return PAPER_CATALOG.find((p) => p.id === id) || null
}

/**
 * 从设计文档参数反推纸种（优先 advanced.paperId）。
 * @param {{ materialId?: string, thicknessMm?: number, advanced?: Record<string, unknown> }} params
 */
export function resolvePaperFromParams(params = {}) {
  const advanced = params.advanced || {}
  const paperId = typeof advanced.paperId === 'string' ? advanced.paperId : ''
  if (paperId) {
    const hit = getPaperById(paperId)
    if (hit) return hit
  }
  const mid = String(params.materialId || 'kraft')
  const t = Number(params.thicknessMm) || 0
  let best = PAPER_CATALOG.find((p) => p.mapMaterialId === mid) || PAPER_CATALOG[0]
  let bestDiff = Infinity
  for (const p of PAPER_CATALOG) {
    if (p.mapMaterialId !== mid) continue
    const d = Math.abs(p.thicknessMm - t)
    if (d < bestDiff) {
      bestDiff = d
      best = p
    }
  }
  return best
}

export function paperLabel(entry, locale = 'zh-CN') {
  if (!entry) return ''
  return locale.startsWith('ko') ? entry.labelKo : entry.labelZh
}
