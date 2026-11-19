/**
 * 可复用 Knife 3D 折叠场景（供 OUTBOX 等第二场景使用；不依赖 Vue）
 * Mesh 构建委托给 src/render/boxModel.js
 */
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {createBoxModel, disposeTree} from '../render/boxModel.js'

/**
 * @param {HTMLElement} container
 * @param {{materialId?:string,background?:number}} opts
 */
export function createKnifeScene(container,{materialId='kraft',background=0xf7f8fa,onPanelSelect=null}={}){
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

  const boxModel=createBoxModel({materialId})
  scene.add(boxModel.root)

  let knife=null
  let progress=1
  let raf=0
  let disposed=false
  let fittedOnce=false
  /** @type {string|null} */
  let selectedPanel=null
  /** @type {{cells:Array,boxSize:{length:number,width:number,height:number},outerSize?:{length:number,width:number,height:number}|null,materialId?:string}|null} */
  let contentsDesc=null
  let contentsGroup=null
  const raycaster=new THREE.Raycaster()
  const pointerNdc=new THREE.Vector2()
  /** @type {{x:number,y:number}|null} */
  let pointerDown=null
  const CLICK_PX=4
  const SELECT_EMISSIVE=new THREE.Color(0x0f6e68)
  const SELECT_INTENSITY=0.28

  function meshGroup(){
    return boxModel.getMeshRoot()
  }

  function clearContents(){
    if(contentsGroup){
      scene?.remove(contentsGroup)
      disposeTree(contentsGroup)
      contentsGroup=null
    }
    setOutboxGhost(false)
  }

  /**
   * 铰链折叠纸箱（0201 等）闭合后约定：X=长 L，Y=高 H，Z=宽 W
   * 不用包围盒猜轴——摇盖开合会拉歪包围盒，导致内容物「穿出」外箱
   */
  function cartonAxisMap(){
    return {length:'x',width:'z',height:'y'}
  }

  /**
   * 兜底：全排列对齐包围盒到 L/W/H（仅无刀版外廓时）
   */
  function assignAxesBySize(size,targetSize){
    const targets={
      length:Number(targetSize.length)||0,
      width:Number(targetSize.width)||0,
      height:Number(targetSize.height)||0
    }
    const axes=['x','y','z']
    const lens={x:size.x,y:size.y,z:size.z}
    const perms=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]
    let best=null
    for(const p of perms){
      const map={length:axes[p[0]],width:axes[p[1]],height:axes[p[2]]}
      const err=
        Math.abs(lens[map.length]-targets.length)
        +Math.abs(lens[map.width]-targets.width)
        +Math.abs(lens[map.height]-targets.height)
      if(!best||err<best.err)best={map,err}
    }
    return best?.map||cartonAxisMap()
  }

  /** 只用侧墙（不含摇盖）算闭合箱体，避免摇盖撑大包围盒导致内容物中心偏移、穿出箱体 */
  function bodyBoxFromWalls(){
    const group=meshGroup()
    if(!group)return null
    const wallNames=new Set(['front','back','left','right'])
    const box=new THREE.Box3()
    let any=false
    group.traverse(o=>{
      if(!o.isMesh||!wallNames.has(o.name))return
      box.expandByObject(o)
      any=true
    })
    if(!any||box.isEmpty())return null
    return box
  }

  /** 显示装箱时让外箱半透明，闭合也能看见内盒；关闭装箱时恢复不透明 */
  function setOutboxGhost(enabled){
    const group=meshGroup()
    if(!group)return
    group.traverse(o=>{
      if(!o.isMesh||!o.material)return
      const mats=Array.isArray(o.material)?o.material:[o.material]
      for(const m of mats){
        if(!m)continue
        if(m.userData?._packOpacity==null)m.userData={...m.userData,_packOpacity:m.opacity??1,_packTransparent:!!m.transparent}
        if(enabled){
          m.transparent=true
          m.opacity=0.38
          m.depthWrite=false
          m.needsUpdate=true
        }else{
          m.transparent=!!m.userData._packTransparent
          m.opacity=m.userData._packOpacity
          m.depthWrite=true
          m.needsUpdate=true
        }
      }
    })
  }

  function placeContents(){
    clearContents()
    const group=meshGroup()
    if(!contentsDesc?.cells?.length||!group||!scene||disposed)return
    const saved=progress
    progress=1
    boxModel.setProgress(100)
    group.updateMatrixWorld(true)
    const box=bodyBoxFromWalls()||new THREE.Box3().setFromObject(group)
    progress=saved
    boxModel.setProgress(progress*100)
    if(box.isEmpty())return
    const size=box.getSize(new THREE.Vector3())
    const center=box.getCenter(new THREE.Vector3())
    const boxSize=contentsDesc.boxSize||{}
    const packL=Number(boxSize.length)||0
    const packW=Number(boxSize.width)||0
    const packH=Number(boxSize.height)||0
    if(!(packL>0&&packW>0&&packH>0))return
    // 单盒任一轴大于内空 → 明显放不下，不画（由上层报错）
    for(const cell of contentsDesc.cells){
      if(cell.length>packL+0.5||cell.width>packW+0.5||cell.height>packH+0.5){
        clearContents()
        return
      }
    }
    const outerSize=contentsDesc.outerSize||knife?.dimensions?.outer||knife?.dimensions?.panel||null
    const axisMap=outerSize?cartonAxisMap():assignAxesBySize(size,boxSize)
    // 侧墙包围盒 ≈ 外廓；把内空缩放到侧墙盒内
    const refL=Number(outerSize?.length)||size[axisMap.length]||packL
    const refW=Number(outerSize?.width)||size[axisMap.width]||packW
    const refH=Number(outerSize?.height)||size[axisMap.height]||packH
    const worldSpan={
      length:size[axisMap.length]*(packL/Math.max(refL,1e-6)),
      width:size[axisMap.width]*(packW/Math.max(refW,1e-6)),
      height:size[axisMap.height]*(packH/Math.max(refH,1e-6))
    }
    // 兜底：侧墙盒异常时退回 mm 绝对值
    if(!(worldSpan.length>1&&worldSpan.width>1&&worldSpan.height>1)){
      worldSpan.length=packL
      worldSpan.width=packW
      worldSpan.height=packH
    }
    // 内容物用实色+描边，和外箱纸纹区分开
    const fill=new THREE.MeshStandardMaterial({
      color:0xb8895c,
      roughness:0.85,
      metalness:0,
      flatShading:true,
      transparent:true,
      opacity:0.95
    })
    const edgeMat=new THREE.LineBasicMaterial({color:0x3a2412})
    contentsGroup=new THREE.Group()
    contentsGroup.name='packContents'
    for(const cell of contentsDesc.cells){
      // packing: x→L, y→W, z→H；场景: x→L, y→H, z→W
      const local={
        length:((cell.x/packL)-0.5)*worldSpan.length,
        width:((cell.y/packW)-0.5)*worldSpan.width,
        height:((cell.z/packH)-0.5)*worldSpan.height
      }
      const pos=new THREE.Vector3()
      pos[axisMap.length]=local.length
      pos[axisMap.width]=local.width
      pos[axisMap.height]=local.height
      pos.add(center)
      const geoSize={x:1,y:1,z:1}
      const shrink=0.96
      geoSize[axisMap.length]=Math.max(1,(cell.length/packL)*worldSpan.length*shrink)
      geoSize[axisMap.width]=Math.max(1,(cell.width/packW)*worldSpan.width*shrink)
      geoSize[axisMap.height]=Math.max(1,(cell.height/packH)*worldSpan.height*shrink)
      const geo=new THREE.BoxGeometry(geoSize.x,geoSize.y,geoSize.z)
      const mesh=new THREE.Mesh(geo,fill.clone())
      mesh.position.copy(pos)
      contentsGroup.add(mesh)
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),edgeMat)
      edges.position.copy(pos)
      contentsGroup.add(edges)
    }
    contentsGroup.visible=true
    scene.add(contentsGroup)
    setOutboxGhost(true)
  }

  function setMeshSelectStyle(mesh,on){
    if(!mesh?.material)return
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material]
    for(const m of mats){
      if(!m||!('emissive' in m))continue
      if(on){
        m.emissive.copy(SELECT_EMISSIVE)
        if('emissiveIntensity' in m)m.emissiveIntensity=SELECT_INTENSITY
      }else{
        m.emissive.setHex(0x000000)
        if('emissiveIntensity' in m)m.emissiveIntensity=0
      }
      m.needsUpdate=true
    }
  }

  function applySelectedHighlight(){
    for(const mesh of boxModel.collectPickableMeshes()){
      setMeshSelectStyle(mesh,!!selectedPanel&&mesh.name===selectedPanel)
    }
  }

  function setSelectedPanel(faceName){
    selectedPanel=faceName||null
    applySelectedHighlight()
  }

  function pickPanelAtClient(clientX,clientY){
    if(!renderer||!camera||disposed)return null
    const rect=renderer.domElement.getBoundingClientRect()
    if(!rect.width||!rect.height)return null
    pointerNdc.x=((clientX-rect.left)/rect.width)*2-1
    pointerNdc.y=-((clientY-rect.top)/rect.height)*2+1
    raycaster.setFromCamera(pointerNdc,camera)
    const hits=raycaster.intersectObjects(boxModel.collectPickableMeshes(),false)
    const hit=hits.find(h=>h.object?.userData?.pickablePanel&&h.object.name)
    return hit?.object?.name||null
  }

  function onPointerDown(ev){
    if(ev.button!=null&&ev.button!==0)return
    pointerDown={x:ev.clientX,y:ev.clientY}
  }

  function onPointerUp(ev){
    if(ev.button!=null&&ev.button!==0){pointerDown=null;return}
    if(!pointerDown)return
    const dx=ev.clientX-pointerDown.x
    const dy=ev.clientY-pointerDown.y
    pointerDown=null
    if((dx*dx+dy*dy)>(CLICK_PX*CLICK_PX))return
    const name=pickPanelAtClient(ev.clientX,ev.clientY)
    if(!name)return
    setSelectedPanel(name)
    if(typeof onPanelSelect==='function')onPanelSelect(name)
  }

  function onPointerCancel(){
    pointerDown=null
  }

  function resetView(){
    if(!camera||!scene)return
    const group=meshGroup()
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
    // 竖长的视口按水平视角取景，避免模型左右被裁
    const aspect=Math.min(1,camera.aspect||1)
    const dist=r/Math.sin((fov*Math.PI/180)/2)*1.15/Math.max(aspect,0.35)
    const dir=new THREE.Vector3(0.8,-0.9,1).normalize()
    camera.position.copy(center).addScaledVector(dir,dist)
    if(controls){
      controls.target.copy(center)
      controls.maxDistance=Math.max(2500,dist*4)
      controls.update()
    }
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

  const canvas=renderer.domElement
  canvas.style.touchAction='none'
  canvas.addEventListener('pointerdown',onPointerDown)
  canvas.addEventListener('pointerup',onPointerUp)
  canvas.addEventListener('pointercancel',onPointerCancel)
  canvas.addEventListener('pointerleave',onPointerCancel)

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
      fittedOnce=false
      clearContents()
      await boxModel.setKnife(nextKnife,nextThickness,nextMaterialId)
      placeContents()
      applySelectedHighlight()
      controls?.update()
      resetView()
      // 回放类刀版位于刀版坐标处而非原点；首帧尺寸未稳定时的取景会落空，下一帧再对准一次
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{if(!disposed)resetView()})
    },
    setProgress(pct){
      progress=Math.max(0,Math.min(1,Number(pct)/100))
      boxModel.setProgress(pct)
    },
    setMaterial(id){
      return boxModel.setMaterial(id).then(()=>{
        placeContents()
        applySelectedHighlight()
        resetView()
      })
    },
    /**
     * @param {{cells:Array,boxSize:{length:number,width:number,height:number},outerSize?:object,materialId?:string}|null} desc
     */
    setContents(desc){
      contentsDesc=desc
      if(!meshGroup()){
        if(!desc)clearContents()
        return
      }
      placeContents()
    },
    /**
     * @param {Record<string, THREE.Texture|null>|null} maps faceName → texture (owned by caller or scene)
     * @param {{takeOwnership?:boolean}} [opts] when true, scene disposes previous owned textures
     */
    setArtworkMaps(maps,opts={}){
      boxModel.setArtworkMaps(maps,opts)
      applySelectedHighlight()
    },
    setSelectedPanel,
    resetView,
    dispose(){
      disposed=true
      cancelAnimationFrame(raf);raf=0
      observer.disconnect()
      canvas.removeEventListener('pointerdown',onPointerDown)
      canvas.removeEventListener('pointerup',onPointerUp)
      canvas.removeEventListener('pointercancel',onPointerCancel)
      canvas.removeEventListener('pointerleave',onPointerCancel)
      controls?.dispose();controls=null
      clearContents()
      selectedPanel=null
      boxModel.dispose()
      scene?.remove(boxModel.root)
      renderer?.dispose()
      renderer?.domElement?.remove()
      renderer=null;scene=null;camera=null;knife=null;contentsDesc=null
    }
  }
}
