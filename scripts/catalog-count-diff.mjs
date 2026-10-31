/**
 * 对表爬虫 CSV（约 2033）与 Demo presets（约 1802），写 未映射名单/15_目录条数差.md
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

const csvCandidates=[
  join(root,'pacdora_boxes_geom.csv'),
  join('C:\\Users\\ROG STRIX\\Desktop\\信息搜集\\webspider\\data search\\data_search\\exports\\pacdora_boxes_geom.csv'),
  join('C:\\Users\\ROG STRIX\\Desktop\\信息搜集\\webspider\\data search\\data_search\\exports\\pacdora_boxes.csv')
]
const geomDir='C:\\Users\\ROG STRIX\\Desktop\\信息搜集\\webspider\\data search\\data_search\\exports\\geometry\\pacdora_boxes'

function splitCsv(line){
  const out=[];let cur='',q=false
  for(let i=0;i<line.length;i++){
    const c=line[i]
    if(q){
      if(c==='"'&&line[i+1]==='"'){cur+='"';i++}
      else if(c==='"')q=false
      else cur+=c
    }else if(c==='"')q=true
    else if(c===','){out.push(cur);cur=''}
    else cur+=c
  }
  out.push(cur)
  return out
}

function loadCsvNums(path){
  const t=readFileSync(path,'utf8').replace(/^\ufeff/,'')
  const lines=t.split(/\r?\n/).filter(Boolean)
  const headers=splitCsv(lines[0])
  const numIdx=headers.findIndex(h=>/模型编号|num|sourceNum/i.test(h))
  if(numIdx<0)throw new Error('no num col in '+path)
  const nums=new Set()
  for(const line of lines.slice(1)){
    const cols=splitCsv(line)
    const n=String(cols[numIdx]||'').trim()
    if(n)nums.add(n)
  }
  return nums
}

const csvPath=csvCandidates.find(p=>existsSync(p))
if(!csvPath){
  console.error('no crawl csv found')
  process.exit(1)
}

const crawlNums=loadCsvNums(csvPath)
const raw=readFileSync(join(root,'src','catalog','presets.js'),'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
const demoNums=new Set((data.presets||[]).map(p=>String(p.sourceNum)))

const onlyCrawl=[...crawlNums].filter(n=>!demoNums.has(n)).sort()
const onlyDemo=[...demoNums].filter(n=>!crawlNums.has(n)).sort()

let geomMissing=0,geomOk=0
const missingGeomSamples=[]
for(const n of onlyCrawl){
  const g=join(geomDir,`${n}.json`)
  if(existsSync(g)){geomOk++;continue}
  geomMissing++
  if(missingGeomSamples.length<30)missingGeomSamples.push(n)
}

const md=[]
md.push('# 目录条数差：爬虫 vs Demo')
md.push('')
md.push(`> 生成时间：${new Date().toISOString()}`)
md.push(`> 爬虫 CSV：\`${csvPath}\``)
md.push('')
md.push('| 集合 | 条数 |')
md.push('|---|---:|')
md.push(`| 爬虫编号 | ${crawlNums.size} |`)
md.push(`| Demo presets | ${demoNums.size} |`)
md.push(`| 仅爬虫有、Demo 无 | ${onlyCrawl.length} |`)
md.push(`| 仅 Demo 有、爬虫无 | ${onlyDemo.length} |`)
md.push(`| 仅爬虫有且本地有 geometry | ${geomOk} |`)
md.push(`| 仅爬虫有且缺 geometry 文件 | ${geomMissing} |`)
md.push('')
md.push('## 判定')
md.push('')
if(geomMissing>50){
  md.push('缺 geometry 文件较多 → **可考虑** 对缺失编号补跑 `pacdora_boxes_geom`。')
}else{
  md.push('缺 geometry 很少或没有 → **不必**为「无盖」全量重爬；Demo 少的条目多半是导入筛选（塑料/不可用尺寸等），不是刀版漏采。')
}
md.push('')
md.push('## 仅爬虫有（前 80 个编号）')
md.push('')
md.push(onlyCrawl.slice(0,80).join(', ')||'（无）')
md.push('')
if(missingGeomSamples.length){
  md.push('## 缺 geometry 抽样')
  md.push('')
  md.push(missingGeomSamples.join(', '))
  md.push('')
}
if(onlyDemo.length){
  md.push('## 仅 Demo 有（前 40）')
  md.push('')
  md.push(onlyDemo.slice(0,40).join(', '))
  md.push('')
}

writeFileSync(join(outDir,'15_目录条数差.md'),md.join('\n'),'utf8')
writeFileSync(join(outDir,'15_目录条数差.json'),JSON.stringify({
  csvPath,
  crawl:crawlNums.size,
  demo:demoNums.size,
  onlyCrawlCount:onlyCrawl.length,
  onlyDemoCount:onlyDemo.length,
  geomOk,
  geomMissing,
  onlyCrawl:onlyCrawl.slice(0,200),
  missingGeomSamples,
  onlyDemo:onlyDemo.slice(0,100)
},null,2),'utf8')
console.log(JSON.stringify({crawl:crawlNums.size,demo:demoNums.size,onlyCrawl:onlyCrawl.length,geomMissing},null,2))
