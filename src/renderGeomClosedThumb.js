/**
 * 运输箱列表：用官方几何合盖 3D 出缩略图（非刀版平面图）。
 */
import * as THREE from 'three'
import {neutralMeshOffset} from './foldSim.js'
import {loadPacdoraGeomKnife} from './pacdoraGeomKnife.js'
import {buildGeomRig} from './geomRig.js'

const cache=new Map()
const colors={kraft:0xc6a47a,white:0xf4f0e7,blue:0x8aa6c8}

function disposeTree(node){
  node.traverse(o=>{
    o.geometry?.dispose()
    if(o.material){
      const ms=Array.isArray(o.material)?o.material:[o.material]
      ms.forEach(m=>m.dispose())
    }
  })
}

function panelMesh(f,T,color,faceHoles=[]){
  const shape=new THREE.Shape()
  const cx=f.x+f.w/2,cy=f.y+f.h/2
  if(Array.isArray(f.outline)&&f.outline.length>=3){
    f.outline.forEach((p,i)=>{
      const x=p[0]-cx,y=-(p[1]-cy)
      if(i)shape.lineTo(x,y); else shape.moveTo(x,y)
    })
    shape.closePath()
  }else{
    shape.moveTo(-f.w/2,-f.h/2)
    shape.lineTo(f.w/2,-f.h/2)
    shape.lineTo(f.w/2,f.h/2)
    shape.lineTo(-f.w/2,f.h/2)
    shape.closePath()
  }
  for(const hole of faceHoles){
    const loop=Array.isArray(hole.loop)&&hole.loop.length>=3
      ?hole.loop
      :[[hole.x,hole.y],[hole.x+hole.w,hole.y],[hole.x+hole.w,hole.y+hole.h],[hole.x,hole.y+hole.h]]
    const path=new THREE.Path()
    loop.forEach((p,i)=>{
      const x=p[0]-cx,y=-(p[1]-cy)
      if(i)path.lineTo(x,y); else path.moveTo(x,y)
    })
    path.closePath()
    shape.holes.push(path)
  }
  const geo=new THREE.ExtrudeGeometry(shape,{depth:T,bevelEnabled:false})
  const mat=new THREE.MeshStandardMaterial({
    color,side:THREE.DoubleSide,roughness:.9,flatShading:!f.smooth
  })
  return new THREE.Mesh(geo,mat)
}

function buildGeomClosedGroup(knife,materialId='kraft'){
  const T=Number(knife.dimensions?.thickness)||1.5
  const color=new THREE.Color(colors[materialId]??colors.kraft)
  const holesByFace=new Map()
  for(const h of knife.holes||[]){
    if(!h?.face)continue
    if(!holesByFace.has(h.face))holesByFace.set(h.face,[])
    holesByFace.get(h.face).push(h)
  }
  const rig=buildGeomRig(knife,{
    makeMesh:f=>panelMesh(f,T,color,holesByFace.get(f.name)||[]),
    zOff:neutralMeshOffset(T).z
  })
  rig.apply(1)
  return rig.root
}

/**
 * @param {string} sourceNum
 * @param {{size?:number,materialId?:string,label?:string,length?:number,width?:number,height?:number,thickness?:number}} opts
 * @returns {Promise<string>} dataURL
 */
export async function renderGeomClosedThumb(sourceNum,{
  size=320,materialId='kraft',label,length,width,height,thickness
}={}){
  const num=String(sourceNum||'')
  const key=`geom|${num}|${materialId}|${size}|v4`
  if(cache.has(key))return cache.get(key)

  try{
    const knife=await loadPacdoraGeomKnife(num,{label,length,width,height,thickness})
    const scene=new THREE.Scene()
    scene.background=new THREE.Color(0xf3f5f8)
    scene.add(new THREE.HemisphereLight(0xffffff,0x8a8d93,2.4))
    const sun=new THREE.DirectionalLight(0xffffff,1.8)
    sun.position.set(220,280,260)
    scene.add(sun)

    const wrap=buildGeomClosedGroup(knife,materialId)
    scene.add(wrap)

    const box=new THREE.Box3().setFromObject(wrap)
    const center=box.getCenter(new THREE.Vector3())
    const sphere=box.getBoundingSphere(new THREE.Sphere())
    const r=Math.max(sphere.radius,20)
    const fov=36
    const camera=new THREE.PerspectiveCamera(fov,1,.1,r*20)
    const dist=r/Math.sin(fov*Math.PI/360)*1.08
    const dir=new THREE.Vector3(1.6,-1.7,1.35).normalize()
    camera.position.copy(center).addScaledVector(dir,dist)
    camera.lookAt(center)

    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false})
    renderer.setSize(size,size,false)
    renderer.setPixelRatio(1)
    renderer.render(scene,camera)
    const url=renderer.domElement.toDataURL('image/png')
    disposeTree(wrap)
    renderer.dispose()
    cache.set(key,url)
    return url
  }catch(e){
    console.warn('geom thumb fail',num,e)
    return ''
  }
}

export function clearGeomThumbCache(){cache.clear()}
