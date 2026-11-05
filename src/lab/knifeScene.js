/**
 * 可复用 Knife 3D 折叠场景（供 OUTBOX 等第二场景使用；不依赖 Vue）
 */
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {neutralMeshOffset,foldRotation} from '../foldSim.js'
import {anglesAtProgress} from '../foldStages.js'
import {buildGeomRig} from '../geomRig.js'
import {ensureBoardPack,createBoardMaterial} from '../boardMaterial.js'

function disposeTree(node){
  node.traverse(o=>{
    o.geometry?.dispose()
    if(o.material){
      const ms=Array.isArray(o.material)?o.material:[o.material]
      ms.forEach(m=>m.dispose())
    }
  })
}

function makePanelMesh(f,faceHoles,thickness,materialId){
  const T=Number(thickness)
  const shape=new THREE.Shape()
  const cx=f.x+f.w/2,cy=f.y+f.h/2
  if(Array.isArray(f.outline)&&f.outline.length>=3){
    f.outline.forEach((p,i)=>{
      const x=p[0]-cx,y=-(p[1]-cy)
      if(i)shape.lineTo(x,y); else shape.moveTo(x,y)
    })
    shape.closePath()
  }else{
    shape.moveTo(-f.w/2,-f.h/2);shape.lineTo(f.w/2,-f.h/2);shape.lineTo(f.w/2,f.h/2);shape.lineTo(-f.w/2,f.h/2);shape.closePath()
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
  const mat=createBoardMaterial(materialId,{flatShading:!f.smooth})
  const mesh=new THREE.Mesh(geo,mat)
  mesh.name=f.name
  const off=neutralMeshOffset(T)
  mesh.position.z=off.z
  return mesh
}

/**
 * @param {HTMLElement} container
 * @param {{materialId?:string,background?:number}} opts
 */
export function createKnifeScene(container,{materialId='kraft',background=0xf7f8fa}={}){
  if(!container)throw new Error('createKnifeScene: container required')

  let scene=new THREE.Scene()
  scene.background=new THREE.Color(background)
  let camera=new THREE.PerspectiveCamera(38,1,.1,5000)
  let renderer=new THREE.WebGLRenderer({antialias:true})
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2))
  container.appendChild(renderer.domElement)
  scene.add(new THREE.HemisphereLight(0xffffff,0x8a8d93,2.7))
  const sun=new THREE.DirectionalLight(0xffffff,2)
  sun.position.set(250,300,300)
  scene.add(sun)
  let controls=new OrbitControls(camera,renderer.domElement)
  controls.enableDamping=true
  controls.minDistance=100
  controls.maxDistance=2500

  let group=null
  let hinges=[]
  let geomRig=null
  let knife=null
  let thickness=3
  let progress=1
  let mid=materialId
  let buildToken=0
  let raf=0
  let disposed=false
  let fittedOnce=false

  function applyFold(){
    const p01=Math.max(0,Math.min(1,Number(progress)))
    if(geomRig){geomRig.apply(p01);return}
    if(!hinges.length)return
    const stages=knife?.foldStages
    const staged=Array.isArray(stages)&&stages.length>0
    const angMap=staged?anglesAtProgress(stages,p01):null
    const stagedKids=staged?new Set(stages.flatMap(st=>(st||[]).map(s=>s.child))):null
    const s=p01*p01*(3-2*p01)
    for(const h of hinges){
      let v
      if(staged){
        if(angMap.has(h.name))v=angMap.get(h.name)
        else if(stagedKids.has(h.name))v=0
        else v=s*h.angle
      }else{
        v=s*h.angle
      }
      if(h.axis){
        const q=new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(h.axis.x,h.axis.y,h.axis.z).normalize(),
          v
        )
        h.anchor.setRotationFromQuaternion(q)
      }else{
        const r=foldRotation(h.side,v)
        h.anchor.rotation.set(r.x,r.y,r.z)
      }
    }
  }

  function resetView(){
    if(!camera||!scene)return
    if(group)group.updateMatrixWorld(true)
    const box=group?new THREE.Box3().setFromObject(group):new THREE.Box3()
    const center=new THREE.Vector3()
    const sphere=new THREE.Sphere()
    if(box.isEmpty()){
      const p=knife?.dimensions?.panel||knife?.dimensions||{}
      const fallback=Math.max(Number(p.length)||200,Number(p.width)||200,Number(p.height)||100,80)
      center.set(0,0,0)
      sphere.radius=fallback
    }else{
      box.getCenter(center)
      box.getBoundingSphere(sphere)
    }
    const r=Math.max(sphere.radius,20)
    const fov=camera.fov||38
    const dist=r/Math.sin((fov*Math.PI/180)/2)*1.15
    const dir=new THREE.Vector3(0.8,-0.9,1).normalize()
    camera.position.copy(center).addScaledVector(dir,dist)
    if(controls){
      controls.target.copy(center)
      controls.maxDistance=Math.max(2500,dist*4)
      controls.update()
    }
  }

  async function rebuild(){
    if(!scene||disposed)return
    const token=++buildToken
    try{await ensureBoardPack(mid)}catch{/* solid */}
    if(token!==buildToken||!scene||disposed)return
    if(group){scene.remove(group);disposeTree(group)}
    group=new THREE.Group()
    scene.add(group)
    hinges=[]
    geomRig=null
    const faces=knife?.faces||[]
    if(!faces.length){applyFold();controls?.update();return}
    const byName=Object.fromEntries(faces.map(f=>[f.name,f]))
    const world=new Map()
    const holesByFace=new Map()
    for(const h of knife.holes||[]){
      if(!h?.face)continue
      if(!holesByFace.has(h.face))holesByFace.set(h.face,[])
      holesByFace.get(h.face).push(h)
    }
    const zOff=neutralMeshOffset(thickness).z
    const panelMesh=f=>makePanelMesh(f,holesByFace.get(f.name)||[],thickness,mid)
    if(knife.geomMode){
      geomRig=buildGeomRig(knife,{makeMesh:panelMesh,zOff})
      group.add(geomRig.root)
      applyFold();controls?.update();resetView()
      return
    }
    function attach(name){
      if(world.has(name))return world.get(name)
      const f=byName[name]
      if(!f)return null
      const mesh=panelMesh(f)
      let anchor
      if(!f.parent){
        anchor=new THREE.Group()
        group.add(anchor)
        anchor.add(mesh)
        world.set(name,{anchor,mesh})
        return world.get(name)
      }
      const p=byName[f.parent]
      if(!p){
        anchor=new THREE.Group();group.add(anchor)
        anchor.add(mesh);world.set(name,{anchor,mesh});return world.get(name)
      }
      const parent=attach(f.parent)
      if(!parent)return null
      const side=f.side
      anchor=new THREE.Group()
      const dx=(f.x+f.w/2)-(p.x+p.w/2),dy=-((f.y+f.h/2)-(p.y+p.h/2))
      const hingeRec=(knife.hinges||[]).find(h=>h.child===name)
      let hx=0,hy=0,axis=null
      if(Array.isArray(f.hingeLine)&&f.hingeLine.length===2){
        const [[ax,ay],[bx,by]]=f.hingeLine
        const mx=(ax+bx)/2,my=(ay+by)/2
        const pcx=p.x+p.w/2,pcy=p.y+p.h/2
        hx=mx-pcx; hy=-(my-pcy)
        const dirX=bx-ax,dirY=-(by-ay)
        const len=Math.hypot(dirX,dirY)||1
        axis={x:dirX/len,y:dirY/len,z:0}
      }else{
        if(side==='top')hy=p.h/2
        if(side==='bottom')hy=-p.h/2
        if(side==='left')hx=-p.w/2
        if(side==='right')hx=p.w/2
      }
      anchor.position.set(hx,hy,0)
      parent.mesh.add(anchor)
      mesh.position.set(dx-hx,dy-hy,zOff)
      anchor.add(mesh)
      const deg=Number.isFinite(hingeRec?.angle)?hingeRec.angle:-90
      hinges.push({anchor,side,axis,name,angle:deg*Math.PI/180})
      world.set(name,{anchor,mesh})
      return world.get(name)
    }
    faces.forEach(f=>attach(f.name))
    applyFold()
    controls?.update()
    resetView()
  }

  function resize(){
    if(!container||!renderer||!camera)return
    const r=container.getBoundingClientRect()
    if(!r.width||!r.height)return
    renderer.setSize(r.width,r.height)
    camera.aspect=r.width/r.height
    camera.updateProjectionMatrix()
    if(!fittedOnce){fittedOnce=true;resetView()}
  }

  const observer=new ResizeObserver(resize)
  observer.observe(container)
  resize()

  const draw=()=>{
    if(disposed)return
    raf=requestAnimationFrame(draw)
    if(!renderer||!scene||!camera)return
    controls?.update()
    renderer.render(scene,camera)
  }
  draw()

  return {
    async setKnife(nextKnife,nextThickness,nextMaterialId){
      knife=nextKnife
      thickness=Number(nextThickness)||3
      if(nextMaterialId)mid=nextMaterialId
      fittedOnce=false
      await rebuild()
    },
    setProgress(pct){
      progress=Math.max(0,Math.min(1,Number(pct)/100))
      applyFold()
    },
    setMaterial(id){
      mid=id||mid
      return rebuild()
    },
    resetView,
    dispose(){
      disposed=true
      cancelAnimationFrame(raf);raf=0
      observer.disconnect()
      controls?.dispose();controls=null
      if(group){scene?.remove(group);disposeTree(group);group=null}
      renderer?.dispose()
      renderer?.domElement?.remove()
      renderer=null;scene=null;camera=null;hinges=[];geomRig=null;knife=null
    }
  }
}
