/**
 * 将邮寄盒官方封面 + 几何 JSON 同步到 public/，供浏览器直接加载。
 */
import {cpSync,mkdirSync,readdirSync,existsSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const docs=join(root,'docs','pacdora_mailer_boxes')
const imgSrc=join(docs,'images','full')
const geomSrc=join(docs,'geometry')
const coverOut=join(root,'public','mailer-covers')
const geomOut=join(root,'public','mailer-geom')

mkdirSync(coverOut,{recursive:true})
mkdirSync(geomOut,{recursive:true})

let covers=0,geoms=0,missingImg=0,missingGeom=0
const nums=new Set()

if(existsSync(geomSrc)){
  for(const f of readdirSync(geomSrc)){
    if(!f.endsWith('.json'))continue
    const num=f.replace(/\.json$/,'')
    nums.add(num)
    cpSync(join(geomSrc,f),join(geomOut,f))
    geoms++
  }
}

if(existsSync(imgSrc)){
  for(const f of readdirSync(imgSrc)){
    if(!/\.(png|jpe?g|webp|svg)$/i.test(f))continue
    const num=f.replace(/\.[^.]+$/,'')
    nums.add(num)
    const dest=f.toLowerCase().endsWith('.png')?`${num}.png`:f
    cpSync(join(imgSrc,f),join(coverOut,dest))
    covers++
  }
}

for(const num of nums){
  if(!existsSync(join(coverOut,`${num}.png`))&&!existsSync(join(imgSrc,`${num}.png`)))missingImg++
  if(!existsSync(join(geomOut,`${num}.json`)))missingGeom++
}

const manifest={
  covers,
  geoms,
  nums:[...nums].sort((a,b)=>String(a).localeCompare(String(b),'en',{numeric:true})),
  missingImg,
  missingGeom,
}
writeFileSync(join(root,'public','mailer-assets-manifest.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({coverOut,geomOut,...manifest},null,2))
