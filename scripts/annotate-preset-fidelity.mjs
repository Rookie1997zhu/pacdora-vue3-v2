/**
 * 给每个导入预设写入吻合度档位 presets[].fidelity，供工作台决定是否开放定制：
 *   exact  精确：拓扑、孔数一致，展开尺寸 ≤0.5%，切线总长 ≤2%，制造尺寸一致（等级 A）
 *   close  近似：面片数一致、展开尺寸 ≤2%（结构对得上，孔或切线细节可能有出入）
 *   none   不达标：结构对不上，或未挂模板 —— 工作台不开放定制
 * 在金样尺寸下用预设当前所挂模板生成、与采集刀版比较；明细见 未映射名单/19_吻合度.csv。
 * 在 catalog-build 末尾运行（模板挂载与参数瘦身之后）。
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {measure,gradeOf,acceptable,presetParams} from './check-pacdora-fidelity.mjs'
import {createGeomResolver} from './lib/presetGeom.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
const geomFileOf=createGeomResolver(root,data.presets)

const summary={}
for(const p of data.presets||[]){
  let tier='none'
  if(p.templateId){
    const file=geomFileOf(p.sourceNum)
    if(file){
      try{
        const geom=JSON.parse(readFileSync(file,'utf8'))
        const m=measure(p.templateId,geom,{
          length:p.length,width:p.width,height:p.height,thickness:p.thickness||.5,
          params:presetParams(p),
        })
        if(gradeOf(m)==='A')tier='exact'
        else if(acceptable(m))tier='close'
      }catch{
        tier='none'
      }
    }
  }
  p.fidelity=tier
  const s=summary[p.categoryId]??={exact:0,close:0,none:0}
  s[tier]++
}

writeFileSync(
  presetsPath,
  `/** auto-generated — fidelity tiers annotated */\nexport default ${JSON.stringify(data,null,2)}\n`
)
console.log(JSON.stringify({fidelity:summary},null,1))
