/**
 * Text → outlines for PDF / AI export.
 *
 * The export draws text with a standard PDF font (Helvetica), which has Latin glyphs only. Chinese,
 * Korean and Japanese text is instead converted to curves here: the glyph outlines are read from a
 * CJK font with fontkit and drawn as filled paths. Outlined text needs no font on the reader's side
 * (and is what print files usually carry), but it is no longer editable as text, and the glyphs come
 * from the fonts found here, not from the font picked in the design editor.
 *
 * Fonts are looked up once, in this order:
 *   1. BOXCRAFT_CJK_FONTS  — paths separated by the platform's path delimiter (; on Windows, : elsewhere)
 *   2. Noto Sans CJK under /usr/share/fonts (the geometry image installs font-noto-cjk)
 *   3. Windows system fonts (local development)
 * Each character is drawn with the first font that has it, so a Chinese-only and a Korean-only font
 * together cover mixed text.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as fontkit from 'fontkit'

const SCRIPT_ORDER = ['sc', 'kr', 'jp', 'tc', 'hk']

function listFontFiles() {
  const out = []
  const env = String(process.env.BOXCRAFT_CJK_FONTS || '').split(path.delimiter).map((s) => s.trim()).filter(Boolean)
  out.push(...env)
  const walk = (dir, depth = 0) => {
    let names = []
    try { names = fs.readdirSync(dir) } catch { return }
    for (const n of names.sort()) {
      const p = path.join(dir, n)
      let st
      try { st = fs.statSync(p) } catch { continue }
      if (st.isDirectory()) { if (depth < 4) walk(p, depth + 1) }
      else if (/NotoSansCJK.*Regular\.(ttc|otc|otf|ttf)$/i.test(n) || /NotoSans(SC|KR|JP)-Regular\.(otf|ttf)$/i.test(n)) out.push(p)
    }
  }
  walk('/usr/share/fonts')
  const win = process.env.WINDIR || process.env.SystemRoot
  if (win) for (const n of ['msyh.ttc', 'malgun.ttf', 'YuGothR.ttc', 'simsun.ttc']) out.push(path.join(win, 'Fonts', n))
  return [...new Set(out)].filter((p) => { try { return fs.statSync(p).isFile() } catch { return false } })
}

let cached = null

/** @returns {Array<object>} fontkit fonts, most preferred first ([] when none is installed) */
export function loadOutlineFonts() {
  if (cached) return cached
  const fonts = []
  for (const file of listFontFiles()) {
    try {
      const f = fontkit.openSync(file)
      const faces = Array.isArray(f.fonts) ? f.fonts : [f]
      // In a collection the faces differ by region: Simplified Chinese first, then Korean, Japanese …
      const rank = (x) => {
        const name = String(x.postscriptName || '').toLowerCase()
        const i = SCRIPT_ORDER.findIndex((s) => name.includes('cjk' + s) || name.endsWith('-' + s))
        return i < 0 ? SCRIPT_ORDER.length : i
      }
      fonts.push(...faces.filter((x) => !/ui$/i.test(String(x.postscriptName || ''))).sort((a, b) => rank(a) - rank(b)))
    } catch { /* unreadable font file: skip */ }
  }
  cached = fonts
  return fonts
}

/** For tests */
export function resetOutlineFonts() { cached = null }

/**
 * Outline one line of text.
 * @param {string} line
 * @param {number} size  font size (any unit; the result uses the same unit)
 * @returns {{width:number,paths:Array<Array<Array<string|number>>>}|null}
 *   paths: one command list per glyph — ['M',x,y] ['L',x,y] ['C',x1,y1,x2,y2,x,y] ['Z'] — with x to the
 *   right from the line start and y UP from the baseline. null: some character has no glyph in any font.
 */
export function outlineText(line, size) {
  const fonts = loadOutlineFonts()
  if (!fonts.length) return null
  // Split into runs drawn by one font each
  const runs = []
  for (const ch of [...String(line ?? '')]) {
    const cp = ch.codePointAt(0)
    let font = fonts.find((f) => f.hasGlyphForCodePoint(cp))
    if (!font) {
      // Whitespace and control characters without a glyph are harmless; anything else is a miss
      if (/\s/.test(ch) || cp < 0x20) font = fonts[0]
      else return null
    }
    const last = runs[runs.length - 1]
    if (last && last.font === font) last.text += ch
    else runs.push({ font, text: ch })
  }
  const paths = []
  let pen = 0
  for (const run of runs) {
    const k = size / run.font.unitsPerEm
    const laid = run.font.layout(run.text)
    laid.glyphs.forEach((g, i) => {
      const pos = laid.positions[i]
      const ox = pen + (pos.xOffset || 0) * k
      const oy = (pos.yOffset || 0) * k
      const cmds = []
      let cx = 0
      let cy = 0
      for (const c of g.path?.commands || []) {
        const a = c.args
        if (c.command === 'moveTo') { cmds.push(['M', ox + a[0] * k, oy + a[1] * k]); cx = a[0]; cy = a[1] }
        else if (c.command === 'lineTo') { cmds.push(['L', ox + a[0] * k, oy + a[1] * k]); cx = a[0]; cy = a[1] }
        else if (c.command === 'quadraticCurveTo') {
          // quadratic → cubic
          const x1 = cx + 2 / 3 * (a[0] - cx), y1 = cy + 2 / 3 * (a[1] - cy)
          const x2 = a[2] + 2 / 3 * (a[0] - a[2]), y2 = a[3] + 2 / 3 * (a[1] - a[3])
          cmds.push(['C', ox + x1 * k, oy + y1 * k, ox + x2 * k, oy + y2 * k, ox + a[2] * k, oy + a[3] * k]); cx = a[2]; cy = a[3]
        } else if (c.command === 'bezierCurveTo') {
          cmds.push(['C', ox + a[0] * k, oy + a[1] * k, ox + a[2] * k, oy + a[3] * k, ox + a[4] * k, oy + a[5] * k]); cx = a[4]; cy = a[5]
        } else if (c.command === 'closePath') cmds.push(['Z'])
      }
      if (cmds.length) paths.push(cmds)
      pen += (pos.xAdvance || 0) * k
    })
  }
  return { width: pen, paths }
}
