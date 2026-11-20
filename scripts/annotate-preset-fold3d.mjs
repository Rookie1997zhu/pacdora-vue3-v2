/**
 * 给每个可定制的导入预设写入 3D 把关结果 presets[].fold3d：
 *   ok       模板折出来的合盖外形与直接回放参考样本一致（三个方向各差 ≤15%）；
 *            或者参考样本的回放本身合不拢、而模板折出来的更接近官方标称的成品外尺寸（各差 ≤10%）
 *   differs  不一致 —— 工作台的 3D 面板改为显示参考样本本身的折叠（不随尺寸变化）
 *   none     模板没有折叠配方 —— 同上
 * 不可定制（fidelity = none）或没有参考几何的预设不写这个字段。
 * 面片大小按真实外轮廓量，多件盒逐件比较（scripts/lib/foldCompare.mjs）。
 * 在 catalog-build 里紧跟 annotate-preset-fidelity 运行。判定方法与 check-fold3d.mjs 相同。
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {TEMPLATES} from '../src/templates/index.js'
import {compareFold} from './lib/foldCompare.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const data=JSON.parse(readFileSync(presetsPath,'utf8').replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())

const summary={}
for(const p of data.presets||[]){
  delete p.fold3d
  const rel=p.geomPublicRel||p.geomRel
  if(!p.templateId||!TEMPLATES[p.templateId]||(p.fidelity!=='exact'&&p.fidelity!=='close')||!rel)continue
  const file=join(root,'public',rel)
  if(!existsSync(file))continue
  let status='none'
  // 「按尺寸插值」模板直接回放官方几何与折叠动画
  if(TEMPLATES[p.templateId].sampled){p.fold3d='ok';(summary[p.categoryId]??={ok:0,differs:0,none:0}).ok++;continue}
  try{
    status=compareFold(p,JSON.parse(readFileSync(file,'utf8'))).status
  }catch{
    status='none'
  }
  p.fold3d=status
  const s=summary[p.categoryId]??={ok:0,differs:0,none:0}
  s[status]++
}

writeFileSync(presetsPath,`/** auto-generated — fidelity tiers annotated */\nexport default ${JSON.stringify(data,null,2)}\n`)
console.log(JSON.stringify({fold3d:summary},null,1))
