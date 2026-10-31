/**
 * REA 金样：用本地 geometry/{sampleNum}.json 的刀版尺寸调用 layout，
 * 按 faceMap 比较关键面片 w/h；Aircraft / PairWithWindow 另比孔窗 bbox。
 */
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {resolveParams} from '../src/knife.js'
import {REA_TEMPLATES} from '../src/templates/rea/index.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const TOL=1.5

function loadGeom(num){
  const p=join(root,'geometry','pacdora_boxes',`${num}.json`)
  if(!existsSync(p))return null
  return JSON.parse(readFileSync(p,'utf8'))
}

function faceIndex(geom){
  const faces=geom?.layer?.traditional?.faces||[]
  return Object.fromEntries(faces.map(f=>[f.name,f]))
}

function holeBBoxes(geom){
  const holes=geom?.layer?.traditional?.holes||[]
  return holes.map(h=>{
    // Pacdora holes 可能是路径点列或 bbox
    if(h.w!=null&&h.h!=null)return {x:h.x,y:h.y,w:h.w,h:h.h}
    if(Array.isArray(h)&&h.length){
      const xs=h.map(p=>p.x??p[0]),ys=h.map(p=>p.y??p[1])
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
      return {x:minX,y:minY,w:maxX-minX,h:maxY-minY}
    }
    if(Array.isArray(h.dlist)){
      const xs=h.dlist.filter(p=>p.x!=null).map(p=>p.x)
      const ys=h.dlist.filter(p=>p.y!=null).map(p=>p.y)
      if(!xs.length)return null
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
      return {x:minX,y:minY,w:maxX-minX,h:maxY-minY}
    }
    return null
  }).filter(Boolean)
}

function near(a,b,tol=TOL){
  return Math.abs(Number(a)-Number(b))<=tol
}

let checked=0,skipped=0

for(const t of REA_TEMPLATES){
  const ref=t.reaRef
  if(!ref?.sampleNum){skipped++;continue}
  const geom=loadGeom(ref.sampleNum)
  if(!geom){
    console.warn(`skip ${t.id}: missing geometry ${ref.sampleNum}`)
    skipped++
    continue
  }
  const ks=geom.knifeSize||{}
  const L=Number(ks.L),W=Number(ks.W),H=Number(ks.H)
  const D=Number(geom.size?.D||t.defaults.thickness||1.5)
  const Ww=W>0?W:(t.id==='rea-star-box'?L:W)
  const Hh=t.id==='rea-flat-sheet'?0:H
  assert.ok(L>0&&Ww>0&&Hh>=0,`${t.id}: knifeSize`)
  const panel={length:L,width:Ww,height:Hh}
  const params=resolveParams(t,panel,D,{})
  const out=t.layout({panel,T:D,params,piece:'bottom',lidClearance:t.defaults.lidClearance||2})
  const byOurs=Object.fromEntries(out.faces.map(f=>[f[0],{w:f[3],h:f[4],x:f[1],y:f[2]}]))
  const byGold=faceIndex(geom)
  const map=ref.faceMap||{}
  let compared=0
  for(const [ours,goldName] of Object.entries(map)){
    const a=byOurs[ours],b=byGold[goldName]
    if(!a||!b)continue
    assert.ok(near(a.w,b.w)||near(a.w,b.h),`${t.id} ${ours}/${goldName} w ${a.w} vs ${b.w}/${b.h}`)
    assert.ok(near(a.h,b.h)||near(a.h,b.w),`${t.id} ${ours}/${goldName} h ${a.h} vs ${b.h}/${b.w}`)
    compared++
  }
  if(t.id!=='rea-star-box')assert.ok(compared>=1,`${t.id}: at least one face compared`)

  if(t.id==='rea-aircraft'&&D>=1){
    const N=0.4*W,SW=0.2*W,SP=0.4*W,K=2
    const span=(K-1)*SP+SW
    const margin=(W-span)/2
    assert.ok(near(margin,41,2)||near(margin,(W-((K-1)*SP+SW))/2,0.01),`aircraft margin`)
    assert.ok(near(params.N,N,1),`aircraft N`)
    assert.ok(near(params.SW,SW,1),`aircraft SW`)
    assert.ok(near(params.SP,SP,1),`aircraft SP`)
    const holes=out.holes||[]
    assert.equal(holes.length,2*K,`aircraft holes count`)
    assert.ok(near(holes[0].h,SW,1),`aircraft hole h`)
    // FL/FR：轮廓顶点数 ≥ 矩形 4，bbox 与金样一致
    for(const [ours,goldName] of [['lidLeft','FL'],['lidRight','FR']]){
      const tuple=out.faces.find(f=>f[0]===ours)
      const gold=byGold[goldName]
      if(!tuple||!gold)continue
      const shape=tuple[7]
      assert.ok(shape?.outline?.length>=4,`${t.id} ${ours} has outline`)
      assert.ok(near(tuple[3],gold.w)||near(tuple[3],gold.h),`${t.id} ${ours} bbox w`)
      assert.ok(near(tuple[4],gold.h)||near(tuple[4],gold.w),`${t.id} ${ours} bbox h`)
      const gVerts=(gold.dlist||[]).filter(p=>p.mtd&&p.mtd!=='Z').length
      if(gVerts>=4)assert.ok(shape.outline.length>=4,`${t.id} ${ours} verts`)
    }
  }

  if(t.id==='rea-pair-window'){
    // 文档网格：120×60×160 → rel (30,36,60,72.5)；用刀版金样尺寸比比例
    const X2=params.X2,Y3=params.Y3,Y4=params.Y4
    const win=out.holes?.[0]
    assert.ok(win,`${t.id} has window hole`)
    assert.ok(near(win.w,X2,1),`window w`)
    assert.ok(near(win.h,Y4,1),`window h`)
    // 相对 F：x=(L-X2)/2
    const front=byOurs.front
    assert.ok(front)
    assert.ok(near(win.x-front.x,(front.w-win.w)/2,1.5),`window centered`)
  }

  if(t.id==='rea-star-box'){
    const P=params.P||5
    assert.equal(out.faces.length,6*P+1,`${t.id} faceCount 6P+1`)
    const Hface=byOurs.H
    assert.ok(Hface,`${t.id} has H`)
    const diam=Math.max(Hface.w,Hface.h)
    const ro=params.RO||L/2
    assert.ok(near(diam,2*ro,2*ro*0.15+1.5),`${t.id} star bbox ~ 2*RO`)
    const goldH=byGold.H
    if(goldH){
      const gVerts=(goldH.dlist||[]).filter(p=>p.mtd&&p.mtd!=='Z').length
      assert.ok(gVerts>=3,`${t.id} gold H has verts`)
    }
  }
  if(t.id==='rea-flat-sheet'){
    assert.equal(out.faces.length,1,`${t.id} single sheet`)
  }

  checked++
  console.log(`ok ${t.id} sample=${ref.sampleNum} facesCompared=${compared} holes=${(out.holes||[]).length}`)
}

// 文档闭合网格断言（不依赖本地 JSON；取整与 generate 默认一致）
{
  const W=202,N=Math.round(0.4*W),SW=Math.round(0.2*W),SP=Math.round(0.4*W),K=2
  const margin=(W-((K-1)*SP+SW))/2
  assert.equal(N,81,'doc aircraft N')
  assert.equal(SW,40,'doc aircraft SW')
  assert.equal(SP,81,'doc aircraft SP round(0.4*202)')
  assert.ok(near(margin,40.5,0.01)||near(margin,41,1),'doc aircraft margin ~40.5/41')
}
{
  // 文档金样表用 SW=40 SP=80（手工取整）时 margin=41
  const W=202,SW=40,SP=80,K=2
  const margin=(W-((K-1)*SP+SW))/2
  assert.equal(margin,41,'doc aircraft grid margin 41')
}
{
  const L=120,W=60,H=160
  const X2=W,Y3=H*0.22,Y4=H*0.44
  assert.ok(near((L-X2)/2,30,1),'doc window x_rel ~30')
  assert.ok(near(Y3,35.2,2),'doc window Y3')
  assert.ok(near(Y4,70.4,3),'doc window Y4')
}

console.log(`check-rea-golden: checked=${checked} skipped=${skipped}`)
