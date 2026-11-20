/**
 * Multi-piece boxes on sampled templates: split the official one-sheet dieline into its pieces and
 * check that nothing is lost or duplicated — every face, fold and cut subpath of the sheet ends up in
 * exactly one piece, and each piece's cut line encloses its faces.
 *   node scripts/audit/check-piece-split.mjs [dump.json]
 */
import fs from 'node:fs'
import {PRESETS} from '../../src/catalog/index.js'
import {TEMPLATES} from '../../src/templates/index.js'
import {knifeFromPacdoraGeom} from '../../src/pacdoraGeomKnife.js'
import {pieceGeometry} from '../../src/templates/sampled/sampledTemplate.js'
import {trim} from '../lib/sampledRegimes.mjs'
import {openFaces} from '../../src/outlineIntegrity.js'

const seen=new Set(),dump={}
let bad=0,total=0
const subpaths=cuts=>(cuts||[]).filter(c=>String(c.mtd).toUpperCase()==='M').length
for(const p of PRESETS){
  const fbId=TEMPLATES[p.templateId]?.sampledFallback||p.templateId
  const pieces=TEMPLATES[p.templateId]?.pieces||TEMPLATES[fbId]?.pieces
  if(!pieces||pieces.length<2||!pieces.every(x=>Array.isArray(x.faces))||seen.has(p.sourceNum))continue
  seen.add(p.sourceNum)
  const raw=trim(JSON.parse(fs.readFileSync(new URL(`../../public/${p.geomRel}`,import.meta.url),'utf8')))
  const keys=Object.keys(raw.layer)
  if(keys.length!==1)continue
  total++
  const ly=raw.layer[keys[0]]
  const whole=knifeFromPacdoraGeom(raw,{sourceNum:p.sourceNum})
  let faces=0,folds=0,subs=0
  const notes=[]
  dump[p.sourceNum]={whole:{faces:whole.faces.map(f=>[f.x,f.y,f.w,f.h]),cuts:whole.cuts,folds:whole.folds},pieces:{}}
  for(const pc of pieces){
    const g=pieceGeometry(raw,pieces,pc.id)
    if(!g){notes.push(`${pc.id}: no geometry`);continue}
    const l=g.layer[keys[0]]
    faces+=l.faces.length;folds+=l.folds.length;subs+=subpaths(l.cuts)
    const k=knifeFromPacdoraGeom(g,{sourceNum:p.sourceNum})
    const open=openFaces(k)
    if(open.length)notes.push(`${pc.id}: open ${open.slice(0,4).join(' ')}`)
    if(!(k.totalX>0&&k.totalY>0))notes.push(`${pc.id}: empty sheet`)
    dump[p.sourceNum].pieces[pc.id]={faces:k.faces.map(f=>[f.x,f.y,f.w,f.h]),cuts:k.cuts,folds:k.folds,size:[k.totalX,k.totalY],stages:(k.foldStages||[]).length}
  }
  if(faces!==ly.faces.length)notes.push(`faces ${faces}/${ly.faces.length}`)
  if(folds!==ly.folds.length)notes.push(`folds ${folds}/${ly.folds.length}`)
  if(subs!==subpaths(ly.cuts))notes.push(`cut subpaths ${subs}/${subpaths(ly.cuts)}`)
  const wholeOpen=openFaces(whole).length
  if(notes.length){bad++;console.log(p.sourceNum,p.categoryId,`(whole sheet open faces: ${wholeOpen})`,notes.join('; '))}
}
console.log(`check-piece-split: ${total-bad}/${total} multi-piece boxes split cleanly`)
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(dump))
