/**
 * Node 端：一次性读入全部「按尺寸插值」模板的数据（public/sampled/*.json）。
 * 浏览器端不走这个文件：vite.config.js 把它别名到 sampledTemplates.browser.js（空），
 * 数据按盒型懒加载（src/templates/lazy.js）。
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','..','public','sampled')
const list=[]
if(fs.existsSync(dir)){
  for(const f of fs.readdirSync(dir).sort()){
    if(!f.endsWith('.json'))continue
    try{
      const d=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))
      // 没启用的盒型只有存根（validate-sampled-templates.mjs），不是模板
      if(d&&d.baseKnife&&d.enabled!==false)list.push(d)
    }catch{/* skip broken file */}
  }
}
export default list
