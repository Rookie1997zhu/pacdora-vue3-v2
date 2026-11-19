/**
 * Imported presets left out of the catalogue: their reference dieline has no fold lines, so they
 * cannot be shown as a folded paper/corrugated box.
 *   model – finished mock-up object (ribbons, drawers, handles…), the dieline is only artwork panels
 *   rigid – multi-layer rigid box (face paper + greyboard)
 *   broken – the reference dieline itself is incomplete (110440: the source only ever returns it with
 *            height 0, so the four wall panels are missing; checked 2026-11-19)
 * Used by src/catalog/index.js, scripts/export-box-mockups-catalog-seed.mjs. To bring one back,
 * delete its line, then run the export script and seed_catalog.
 */
export const EXCLUDED_PRESETS = Object.freeze({
  'import-gift-315303': 'model',
  'import-gift-36021001': 'rigid',
  'import-gift-362011': 'rigid',
  'import-gift-36201101': 'rigid',
  'import-gift-36201102': 'rigid',
  'import-gift-36201107': 'rigid',
  'import-gift-550250': 'model',
  'import-gift-603651': 'model',
  'import-gift-60365101': 'model',
  'import-gift-603652': 'model',
  'import-gift-603653': 'model',
  'import-gift-603654': 'model',
  'import-gift-603655': 'model',
  'import-gift-603656': 'model',
  'import-gift-603657': 'model',
  'import-gift-603658': 'model',
  'import-gift-603659': 'model',
  'import-gift-603660': 'model',
  'import-gift-603661': 'model',
  'import-gift-603662': 'model',
  'import-gift-603663': 'model',
  'import-gift-603664': 'model',
  'import-gift-603665': 'model',
  'import-gift-603666': 'model',
  'import-gift-603667': 'model',
  'import-gift-603668': 'model',
  'import-gift-603669': 'model',
  'import-gift-603671': 'model',
  'import-gift-603672': 'model',
  'import-gift-603673': 'model',
  'import-gift-603674': 'model',
  'import-gift-603675': 'model',
  'import-gift-603676': 'model',
  'import-gift-603950': 'model',
  'import-gift-610330': 'model',
  'import-gift-610340': 'model',
  'import-gift-615300': 'model',
  'import-gift-615301': 'model',
  'import-gift-615302': 'model',
  'import-gift-615304': 'model',
  'import-gift-615305': 'model',
  'import-gift-615306': 'model',
  'import-gift-615307': 'model',
  'import-gift-615308': 'model',
  'import-gift-615309': 'model',
  'import-gift-615310': 'model',
  'import-gift-615311': 'model',
  'import-gift-615312': 'model',
  'import-gift-615313': 'model',
  'import-gift-615314': 'model',
  'import-gift-615315': 'model',
  'import-square-36021001': 'rigid',
  'import-square-36201101': 'rigid',
  'import-square-36201102': 'rigid',
  'import-tray-110440': 'broken',
})

export function isExcludedPreset(id) {
  return Object.prototype.hasOwnProperty.call(EXCLUDED_PRESETS, String(id || ''))
}
