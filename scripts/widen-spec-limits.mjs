/**
 * 把结构规格的尺寸范围（spec.limits）按维度单独放宽，其余内容原样不动。
 *
 * patch-spec-limits.mjs 收窄时先让三个尺寸同比例缩放，哪一档先坏就把三个维度一起限在那一档以内。
 * 这样偏保守：有的盒型只改高度其实没问题，也被一起限住了（对照官方样本，有 4 个本来准确的尺寸因此选不到）。
 * 这里对每个维度、每一头单独再试：其余两个尺寸保持默认，从现在的边界往外一档一档走（每档 = 默认值的 5%），
 * 走到刀版不完整（校验不过，含轮廓检查）或到了收窄之前的范围为止。每走一档还要再验一次「角上」的组合
 * （所有尺寸同时走到这一头），角上不成立就不走这一档：只验单个维度的话范围会宽很多，但三个尺寸一起
 * 缩到头时被轮廓检查拦住的情况从 13 例涨到 109 例（45 个盒型），用户会在允许的范围里频繁碰到「不能保存」。
 *
 * 只放宽、不收窄。范围内的其他组合仍可能不成立 —— 那种情况由轮廓检查当场拦住，不会放出坏刀版
 * （scripts/audit/scan-outline-check.mjs 统计个数）。
 *
 * 收窄之前的范围取自一个旧版本的 structureSpecs.js（--from <file>）：
 *   git show 20fd4fa:src/catalog/structureSpecs.js > old.js
 *   node scripts/widen-spec-limits.mjs --from old.js [--dry]
 * 之后需运行 build-spec-chunks、export-workbench-templates-seed，并在后端重新 seed_catalog。
 */
import {readFileSync, writeFileSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createKnife} from '../src/knife.js'
import {TEMPLATES} from '../src/templates/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const specPath = join(root, 'src', 'catalog', 'structureSpecs.js')
const dry = process.argv.includes('--dry')
const fromArg = process.argv.indexOf('--from')
if (fromArg < 0 || !process.argv[fromArg + 1]) {
  console.error('usage: node scripts/widen-spec-limits.mjs --from <old structureSpecs.js> [--dry]')
  process.exit(2)
}
const parse = (text) => ({header: text.slice(0, text.indexOf('export default ')), data: JSON.parse(text.slice(text.indexOf('export default ') + 15).trim())})
const {header, data} = parse(readFileSync(specPath, 'utf8'))
const old = new Map(parse(readFileSync(process.argv[fromArg + 1], 'utf8')).data.specs.map((s) => [s.code, s]))

const DIMS = ['length', 'width', 'height']
const STEP = 0.05
const usable = (r) => Array.isArray(r) && r.length === 2 && Number(r[1]) > Number(r[0]) && !(Number(r[0]) === 0 && Number(r[1]) >= 2000)
const r1 = (v) => Math.round(v * 10) / 10

const changed = []
for (const spec of data.specs) {
  const t = TEMPLATES[`spec-${spec.code}`]
  const before = old.get(spec.code)
  if (!t || !spec.limits || !before?.limits) continue
  const def = spec.defaults
  const dims = DIMS.filter((d) => usable(spec.limits[d]) && usable(before.limits[d]) && Number(def[d]) > 0)
  if (!dims.length) continue
  const pieces = (t.pieces || []).map((p) => p.id)
  const whole = (size) => {
    for (const piece of pieces.length ? pieces : [undefined]) {
      let k
      try { k = createKnife({templateId: t.id, ...def, ...size, thickness: def.thickness, bleed: 0, sizeMode: 'inner', piece, previewBleedExtra: 0}) }
      catch { return false }
      if (!k.validation?.ok) return false
    }
    return true
  }
  if (!whole({})) continue
  // 试的时候模板还带着收窄后的范围，会把尺寸钳回去：先临时换成旧范围
  const live = {...t.limits}
  t.limits = {...t.limits, ...Object.fromEntries(dims.map((d) => [d, [...before.limits[d]]]))}
  const lim = Object.fromEntries(dims.map((d) => [d, [...spec.limits[d]]]))
  // 角上的组合：所有尺寸同时走到这一头（当前边界），其中 d 换成要试的值
  const corner = (end, d, v) => Object.fromEntries(dims.map((x) => [x, x === d ? v : lim[x][end]]))
  for (const d of dims) {
    const step = Number(def[d]) * STEP
    // 往小走
    for (let v = lim[d][0] - step, guard = 0; guard++ < 60; v -= step) {
      const vv = Math.max(Number(before.limits[d][0]), r1(v))
      if (vv >= lim[d][0] - 1e-9 || !whole({[d]: vv}) || !whole(corner(0, d, vv))) break
      lim[d][0] = vv
      if (vv <= Number(before.limits[d][0])) break
    }
    // 往大走
    for (let v = lim[d][1] + step, guard = 0; guard++ < 60; v += step) {
      const vv = Math.min(Number(before.limits[d][1]), r1(v))
      if (vv <= lim[d][1] + 1e-9 || !whole({[d]: vv}) || !whole(corner(1, d, vv))) break
      lim[d][1] = vv
      if (vv >= Number(before.limits[d][1])) break
    }
  }
  t.limits = live
  const was = JSON.stringify(Object.fromEntries(dims.map((d) => [d, spec.limits[d]])))
  if (JSON.stringify(lim) === was) continue
  changed.push({code: spec.code, sample: spec.sampleNum, def: dims.map((d) => def[d]).join('x'), from: dims.map((d) => spec.limits[d].join('–')).join(' / '), to: dims.map((d) => lim[d].join('–')).join(' / ')})
  if (!dry) { spec.limits = {...spec.limits, ...lim}; t.limits = {...t.limits, ...lim} }
}
if (!dry && changed.length) writeFileSync(specPath, `${header}export default ${JSON.stringify(data)}\n`)
console.log(`widen-spec-limits: ${changed.length} specs ${dry ? 'would change' : 'updated'}`)
for (const c of changed) console.log(`  ${c.code} (样本 ${c.sample}, 默认 ${c.def}): ${c.from}  →  ${c.to}`)
