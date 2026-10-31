import {readFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const base=join(dirname(fileURLToPath(import.meta.url)),'..','未映射名单')

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

function loadCsv(name){
  const t=readFileSync(join(base,name),'utf8').replace(/^\ufeff/,'')
  const lines=t.split(/\r?\n/).filter(Boolean)
  const headers=splitCsv(lines[0])
  return lines.slice(1).map(line=>{
    const cols=splitCsv(line)
    const o={}
    headers.forEach((h,i)=>o[h]=cols[i]??'')
    return o
  })
}

const all=loadCsv('08_未映射_suggestAction全量标注.csv')
const need=loadCsv('08_需新模板_公开展开可矩形化.csv')
const pub=loadCsv('08_公开展开可矩形化_全部.csv')

const by={}
for(const r of all){
  const a=(r.suggestAction||'').trim()||'(空)'
  by[a]=(by[a]||0)+1
}

function topLabels(rows,n=12){
  const bag={}
  for(const r of rows){
    const k=String(r.label||'').toLowerCase().replace(/\s+/g,' ').slice(0,50)
    bag[k]=(bag[k]||0)+1
  }
  return Object.entries(bag).sort((a,b)=>b[1]-a[1]).slice(0,n)
}

const needByCode={}
for(const r of need){
  const c=r.structureCode||r.code||r.结构code||'(无code)'
  needByCode[c]=(needByCode[c]||0)+1
}

console.log(JSON.stringify({
  allCount:all.length,
  byAction:by,
  needCount:need.length,
  pubCount:pub.length,
  headersAll:Object.keys(all[0]||{}),
  headersNeed:Object.keys(need[0]||{}),
  topNeedLabels:topLabels(need,15),
  topMappable:topLabels(all.filter(r=>r.suggestAction==='可映射'),10),
  topSizeOnly:topLabels(all.filter(r=>r.suggestAction==='仅尺寸'),10),
  needCodeTop:Object.entries(needByCode).sort((a,b)=>b[1]-a[1]).slice(0,15),
  sampleNeed:need.slice(0,5).map(r=>({num:r.sourceNum,label:r.label,action:r.suggestAction,cluster:r.cluster})),
  sampleMappable:all.filter(r=>r.suggestAction==='可映射').slice(0,5).map(r=>({num:r.sourceNum,label:r.label,suggestTemplate:r.suggestTemplate||r.templateHint||r.建议模板}))
},null,2))
