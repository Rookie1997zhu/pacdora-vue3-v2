/**
 * 有多尺寸采样数据的盒型（public/sampled/<类目>-<编号>.json）改用「按尺寸插值」模板：
 * 预设的 templateId → sampled-<类目>-<编号>。在 catalog-build 里排在 apply-structure-specs 之后、
 * 参数瘦身与吻合度标注之前运行。同结构的其他编号（衍生样机）不受影响，仍用结构规格模板。
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import SAMPLED_INDEX from '../src/catalog/sampledIndex.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const text=readFileSync(presetsPath,'utf8')
const head=(/^\/\*\*[\s\S]*?\*\//.exec(text)||['/** auto-generated */'])[0]
const data=JSON.parse(text.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())

let applied=0,reverted=0
for(const p of data.presets||[]){
  const key=`${p.categoryId}-${p.sourceNum}`
  if(!SAMPLED_INDEX[key]){
    // 曾经启用、后来验证不达标而撤下的：改回数据文件里记录的参数化模板
    if(String(p.templateId||'').startsWith('sampled-')){
      const f=join(root,'public','sampled',`${key}.json`)
      const fb=existsSync(f)?JSON.parse(readFileSync(f,'utf8')).fallback:null
      p.templateId=fb||null
      p.templateSource=fb?'structure-spec':undefined
      reverted++
    }
    continue
  }
  const id=`sampled-${key}`
  if(p.templateId!==id){
    p.templateId=id
    p.templateSource='sampled'
  }
  applied++
}
writeFileSync(presetsPath,`${head}\nexport default ${JSON.stringify(data,null,2)}\n`)
console.log(JSON.stringify({sampledTemplatesApplied:applied,reverted,available:Object.keys(SAMPLED_INDEX).length}))
