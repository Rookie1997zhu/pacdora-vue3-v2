/**
 * 新手纸种风险提示（规则表，非 AI）。
 * @typedef {import('./paperCatalog.js').PaperEntry} PaperEntry
 */

/**
 * @typedef {object} PaperRisk
 * @property {'warn'|'danger'} level
 * @property {string} code
 */

/**
 * @param {PaperEntry|null|undefined} paper
 * @param {{ lengthMm?: number, widthMm?: number, heightMm?: number }} dims
 * @returns {PaperRisk[]}
 */
export function evaluatePaperRisks(paper, dims = {}) {
  /** @type {PaperRisk[]} */
  const out = []
  if (!paper) return out

  const H = Number(dims.heightMm) || 0
  const L = Number(dims.lengthMm) || 0
  const W = Number(dims.widthMm) || 0
  const maxSide = Math.max(L, W, H)
  const tags = new Set(paper.riskTags || [])

  if (tags.has('thin_board') && H >= 120) {
    out.push({ level: 'danger', code: 'thin_tall' })
  } else if (tags.has('thin_board') && H >= 80) {
    out.push({ level: 'warn', code: 'thin_mid_height' })
  }

  if (tags.has('art_paper') && H >= 150) {
    out.push({ level: 'warn', code: 'art_tall_prefer_flute' })
  }

  if (tags.has('art_paper') && maxSide >= 350 && (paper.gsm || 0) > 0 && (paper.gsm || 0) < 300) {
    out.push({ level: 'warn', code: 'art_large_panel' })
  }

  if (tags.has('flute') && paper.flute === 'E' && H >= 250) {
    out.push({ level: 'warn', code: 'e_flute_tall' })
  }

  if (!tags.has('flute') && (paper.gsm || 0) > 0 && (paper.gsm || 0) <= 150 && maxSide >= 280) {
    out.push({ level: 'danger', code: 'light_gsm_large' })
  }

  return out
}
