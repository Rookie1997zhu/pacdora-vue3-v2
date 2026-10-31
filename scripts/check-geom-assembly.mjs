// 运输箱官方几何：回放动画到合盖，包围盒应接近样本外尺寸（多件款须拼合，不得散开）。
import {readFileSync,readdirSync} from 'fs'
import * as THREE from 'three'
import {knifeFromPacdoraGeom} from '../src/pacdoraGeomKnife.js'
import {buildGeomRig} from '../src/geomRig.js'

const dir=new URL('../public/shipping-geom/',import.meta.url)
const presetsSrc=readFileSync(new URL('../src/catalog/presets.js',import.meta.url),'utf8')
const only=process.argv.slice(2)

function presetDims(num){
  const m=presetsSrc.match(new RegExp(`"sourceNum":\\s*"${num}"[\\s\\S]*?"length":\\s*([\\d.]+),[\\s\\S]*?"width":\\s*([\\d.]+),[\\s\\S]*?"height":\\s*([\\d.]+)`))
  return m?[+m[1],+m[2],+m[3]]:null
}

function closedBox(knife){
  const rig=buildGeomRig(knife,{
    makeMesh:f=>new THREE.Mesh(new THREE.BoxGeometry(Math.max(f.w,.1),Math.max(f.h,.1),.1)),
    zOff:0
  })
  rig.apply(1)
  rig.root.updateMatrixWorld(true)
  const size=new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3())
  return [size.x,size.y,size.z]
}

const files=readdirSync(dir).filter(f=>f.endsWith('.json'))
let bad=0
for(const f of files){
  const num=f.replace('.json','')
  if(only.length&&!only.includes(num))continue
  const knife=knifeFromPacdoraGeom(JSON.parse(readFileSync(new URL(f,dir),'utf8')),{sourceNum:num})
  const got=closedBox(knife).sort((a,b)=>b-a)
  const want=(presetDims(num)||[0,0,0]).slice().sort((a,b)=>b-a)
  // 插舌/挂耳会略超出外尺寸；超过 1.35 倍视为散件
  const ratio=Math.max(...got.map((g,i)=>g/Math.max(want[i],1)))
  const ok=ratio<1.35
  if(!ok)bad++
  console.log(`${ok?'ok  ':'FAIL'} ${num} closed=${got.map(v=>v.toFixed(0)).join('x')} sample=${want.join('x')} ratio=${ratio.toFixed(2)}`)
}
if(bad){console.error(`check-geom-assembly: ${bad} failed`);process.exit(1)}
console.log('check-geom-assembly: all passed')
