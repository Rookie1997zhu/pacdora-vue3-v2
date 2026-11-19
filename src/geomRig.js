/**
 * 官方几何 3D 骨架：回放 Pacdora 动画（旋转 + 平移），工位与列表封面共用。
 * 刀版坐标 (x 右, y 下, z 入纸) → 场景 (x, -y, -z)，保持右手系，转角符号不变。
 */
import * as THREE from 'three'
import {foldRotation} from './foldSim.js'
import {anglesAtProgress,translationsAtProgress,translatedFaces,spinsAtProgress} from './foldStages.js'

const ZERO=Object.freeze({x:0,y:0,z:0})

function smoothstep(x){
  const u=Math.max(0,Math.min(1,x))
  return u*u*(3-2*u)
}

/** 动画 vector 为准；桥接折线常为零长度，不能用来定轴 */
function hingeAxis(face,hinge){
  const v=hinge?.axisVec
  if(v){
    const x=Number(v.x)||0,y=-(Number(v.y)||0),z=-(Number(v.z)||0)
    const len=Math.hypot(x,y,z)
    if(len>1e-12)return new THREE.Vector3(x/len,y/len,z/len)
  }
  if(Array.isArray(face.hingeLine)&&face.hingeLine.length===2){
    const [[ax,ay],[bx,by]]=face.hingeLine
    const x=bx-ax,y=-(by-ay)
    const len=Math.hypot(x,y)
    if(len>1e-6)return new THREE.Vector3(x/len,y/len,0)
  }
  return null
}

/** 零长度折线（桥接点）的坐标是父件平移之后的位置，而非展开位置 */
function isPointHinge(face){
  if(!Array.isArray(face.hingeLine)||face.hingeLine.length!==2)return false
  const [[ax,ay],[bx,by]]=face.hingeLine
  return Math.hypot(bx-ax,by-ay)<1e-6
}

function hingePivot(face,parent){
  if(Array.isArray(face.hingeLine)&&face.hingeLine.length===2){
    const [[ax,ay],[bx,by]]=face.hingeLine
    return {x:(ax+bx)/2,y:(ay+by)/2}
  }
  const pcx=parent.x+parent.w/2,pcy=parent.y+parent.h/2
  if(face.side==='top')return {x:pcx,y:parent.y}
  if(face.side==='bottom')return {x:pcx,y:parent.y+parent.h}
  if(face.side==='left')return {x:parent.x,y:pcy}
  return {x:parent.x+parent.w,y:pcy}
}

const IDENTITY_Q=new THREE.Quaternion()
/** 装配偏移超过该层自身尺寸这么多倍，视为「停放在场外」（样本里停放的都 ≥4.9 倍，真实装配偏移都 ≤2.1 倍） */
const FAR_FACTOR=3.5
const ORIGIN=new THREE.Vector3()
const SCRATCH_SCALE=new THREE.Vector3()
const SCRATCH_OFFSET=new THREE.Vector3()

/**
 * 多层盒的装配。官方每层给出 transform（position + 欧拉角 rotate），作用在该层自己的刀版坐标
 * (x, y, 0) 上，得到 Y 轴朝上的成品坐标。本骨架里刀版坐标是 (x, -y, -z)（绕 X 转 180°），
 * 且各层在合并版面上平移过 (piece.x, piece.y)，所以每层的目标矩阵为
 *   C · Rx(90°) · T(position) · R(rotate) · T(-piece.x, -piece.y, 0) · Rx(180°)
 * 其中 Rx(90°) 让成品的顶面朝向镜头，C 把成品移到版面中心（镜头不用跟着跑）。
 */
function assemblyGroups(knife,root){
  const pieces=(knife?.sheetPieces||[]).filter(p=>p?.transform)
  if(pieces.length<2)return {groupAt:()=>null,pieceAt:()=>null,apply:()=>{},verify:()=>false}
  // 灰板等没有给装配位姿的层（position / rotate 全为 0）：成品里被面纸包在里面，官方也不单独摆放。
  // 展开时照常平铺显示，开始装配后隐藏。
  const placed=p=>{
    if(p.inert)return false
    const t=p.transform
    // 官方把不参与成品展示的层挪到很远处（x = 10 倍宽度、12300 等）
    const reach=FAR_FACTOR*Math.max(Number(p.w)||0,Number(p.h)||0,1)
    if(['x','y','z'].some(k=>Math.abs(Number(t.position[k])||0)>reach))return false
    return ['x','y','z'].some(k=>Math.abs(Number(t.position[k])||0)>1e-9||Math.abs(Number(t.rotate[k])||0)>1e-9)
  }
  const anyPlaced=pieces.some(placed)
  const sheetCenter=new THREE.Vector3((Number(knife.totalX)||0)/2,-(Number(knife.totalY)||0)/2,0)
  const center=new THREE.Matrix4().makeTranslation(sheetCenter.x,sheetCenter.y,0)
  // 成品坐标 Y 朝上 → 场景里朝向镜头一侧（+Z），从上方看到盒子
  const up=new THREE.Matrix4().makeRotationX(Math.PI/2)
  const flip=new THREE.Matrix4().makeRotationX(Math.PI)
  const upOnly=new THREE.Matrix4().makeRotationX(Math.PI/2)
  const items=pieces.map(p=>{
    const group=new THREE.Group()
    root.add(group)
    const t=p.transform
    const m=new THREE.Matrix4()
      .multiply(center)
      .multiply(up)
      .multiply(new THREE.Matrix4().makeTranslation(Number(t.position.x)||0,Number(t.position.y)||0,Number(t.position.z)||0))
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Number(t.rotate.x)||0,Number(t.rotate.y)||0,Number(t.rotate.z)||0,'XYZ')))
      .multiply(new THREE.Matrix4().makeTranslation(-p.x,-p.y,0))
      .multiply(flip)
    const pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scl=new THREE.Vector3()
    m.decompose(pos,quat,scl)
    // 官方 3D 结果对照得到的逐步位置修正（官方成品坐标）→ 场景坐标里的位移
    const refOffsets=knife.assemblyRef?.layers?.[p.id]
    const stageOffsets=Array.isArray(refOffsets)
      ?refOffsets.map(o=>new THREE.Vector3(o[0],o[1],o[2]).applyMatrix4(upOnly))
      :null
    return {piece:p,group,pos,quat,stageOffsets,loose:anyPlaced&&!placed(p)}
  })
  let enabled=true
  const at=(x,y)=>items.find(it=>x>=it.piece.x-1e-6&&x<=it.piece.x+it.piece.w+1e-6&&y>=it.piece.y-1e-6&&y<=it.piece.y+it.piece.h+1e-6)
  return {
    /** 场景坐标 → 官方成品坐标（Y 朝上，mm）：用于与官方 3D 结果对照 */
    toReference:new THREE.Matrix4().multiplyMatrices(center,up).invert(),
    items,
    pieceAt(x,y){return at(x,y)?.piece||null},
    groupAt(x,y){
      const hit=items.find(it=>x>=it.piece.x-1e-6&&x<=it.piece.x+it.piece.w+1e-6&&y>=it.piece.y-1e-6&&y<=it.piece.y+it.piece.h+1e-6)
      return hit?hit.group:null
    },
    /**
     * 自检：折好并装配后，可见部分的包围盒应与官方标称的成品外尺寸一致（各边 0.9–1.25 倍）。
     * 对不上说明这款盒子的装配用到了尚未支持的动作（整件翻面、开盖展示姿态、抽屉拉出等），
     * 此时关闭装配，退回各片分开折叠的散件视图，避免显示一堆错位的纸板。
     */
    verify(applyAll){
      // 有官方对照数据的盒型：对照时已确认过吻合程度
      if(knife.assemblyRef)return knife.assemblyRef.ok!==false
      const o=knife.assemblyOuter
      const ref=o?[o.L,o.W,o.H].map(Number).sort((a,b)=>b-a):null
      let ok=false
      if(ref&&ref[2]>0){
        applyAll(1)
        root.updateMatrixWorld(true)
        const box=new THREE.Box3()
        root.traverse(obj=>{
          if(!obj.isMesh)return
          for(let p=obj;p;p=p.parent)if(p.visible===false)return
          box.expandByObject(obj)
        })
        if(!box.isEmpty()){
          const sz=box.getSize(new THREE.Vector3())
          const dims=[sz.x,sz.y,sz.z].sort((a,b)=>b-a)
          ok=dims.every((d,i)=>d/ref[i]>0.9&&d/ref[i]<1.25)
        }
      }
      if(!ok){
        enabled=false
        for(const it of items){
          it.group.visible=true
          it.group.scale.setScalar(1)
          it.group.position.set(0,0,0)
          it.group.quaternion.identity()
        }
      }
      return ok
    },
    apply(k,u=0){
      if(!enabled)return
      for(const it of items){
        if(it.loose){
          // 隐藏并缩到成品中心：包围盒（取景）不再把它算进去
          const flat=k<0.02
          it.group.visible=flat
          it.group.scale.setScalar(flat?1:1e-4)
          it.group.position.copy(flat?ORIGIN:sheetCenter)
          continue
        }
        it.group.position.lerpVectors(ORIGIN,it.pos,k)
        if(it.stageOffsets){
          // u：以「步」为单位的进度；在相邻两步的修正量之间插值
          const last=it.stageOffsets.length-1
          const i=Math.max(0,Math.min(last,Math.floor(u)))
          const j=Math.min(last,i+1)
          const f=smoothstep(u-i)
          it.group.position.addScaledVector(SCRATCH_OFFSET.lerpVectors(it.stageOffsets[i],it.stageOffsets[j],f),k)
        }
        it.group.quaternion.slerpQuaternions(IDENTITY_Q,it.quat,k)
      }
    }
  }
}

/**
 * 圆筒盒：一个圆片 + 两条长度等于圆周（π·直径）的矩形（筒身、盖沿）。
 * 这类盒型来源不给折叠步骤（官方用现成模型展示），平面折叠也折不出圆柱，单独处理。
 * @returns {{disc:object,body:object,rim:object}|null}
 */
export function detectTube(knife){
  const faces=knife?.faces||[]
  if(faces.length!==3)return null
  if((knife?.foldStages||[]).length)return null
  const isDisc=f=>Array.isArray(f.outline)&&f.outline.length>=16&&f.w>1&&Math.abs(f.w-f.h)<=0.02*f.w
  const disc=faces.find(isDisc)
  if(!disc)return null
  const rects=faces.filter(f=>f!==disc&&!isDisc(f)&&(!Array.isArray(f.outline)||f.outline.length<=5))
  if(rects.length!==2)return null
  const circ=Math.PI*disc.w
  if(!rects.every(f=>Math.abs(f.w-circ)<=0.03*circ))return null
  // 盖沿与圆片相连（或两条里较矮的一条），另一条是筒身
  const linked=rects.find(f=>disc.parent===f.name||f.parent===disc.name)
  const rim=linked||(rects[0].h<=rects[1].h?rects[0]:rects[1])
  const body=rects.find(f=>f!==rim)
  return {disc,body,rim}
}

const TUBE_SEGMENTS=72

/** 可弯曲的条带：外表面（+z，印刷面）与内表面两层网格，UV 与平板面片一致（面片局部 mm 坐标） */
function tubeStripGeometry(w,h,T){
  const n=TUBE_SEGMENTS,cols=n+1
  const flat=new Float32Array(cols*2*2*3),uv=new Float32Array(cols*2*2*2),index=[]
  for(let layer=0;layer<2;layer++){
    for(let i=0;i<cols;i++){
      const u=-w/2+w*i/n
      for(let j=0;j<2;j++){
        const v=j?h/2:-h/2,k=(layer*cols+i)*2+j
        flat.set([u,v,layer?T:0],k*3)
        uv.set([u,v],k*2)
      }
    }
    for(let i=0;i<n;i++){
      const a=(layer*cols+i)*2,b=a+1,c=a+2,d=a+3
      // 外层朝 +z，内层朝 -z
      if(layer)index.push(a,c,b,b,c,d)
      else index.push(a,b,c,b,d,c)
    }
  }
  const geo=new THREE.BufferGeometry()
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(flat),3))
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2))
  geo.setIndex(index)
  geo.userData.flat=flat
  geo.userData.w=w
  return geo
}

/** 把条带绕竖直轴卷起：k=0 平铺，k=1 卷成整圆。朝 -z 卷，印刷面（+z）在圆柱外侧 */
function bendTubeStrip(geo,k){
  const flat=geo.userData.flat,w=geo.userData.w,pos=geo.attributes.position
  const theta=2*Math.PI*Math.max(0,Math.min(1,k))
  for(let i=0;i<pos.count;i++){
    const u=flat[i*3],v=flat[i*3+1],z0=flat[i*3+2]
    if(theta<1e-5){pos.setXYZ(i,u,v,z0);continue}
    const r=w/theta,phi=u*theta/w
    pos.setXYZ(i,(r+z0)*Math.sin(phi),v,-r+(r+z0)*Math.cos(phi))
  }
  pos.needsUpdate=true
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
}

function buildTubeRig(knife,tube,{makeMesh,zOff=0}){
  const root=new THREE.Group()
  const nodes=new Map()
  const R=tube.body.w/(2*Math.PI)
  const strips=[]
  for(const f of [tube.body,tube.rim,tube.disc]){
    const mesh=makeMesh(f)
    const anchor=new THREE.Group(),mover=new THREE.Group()
    anchor.add(mover);mover.add(mesh);root.add(anchor)
    anchor.position.set(f.x+f.w/2,-(f.y+f.h/2),0)
    mesh.position.set(0,0,zOff)
    if(f!==tube.disc){
      mesh.geometry?.computeBoundingBox?.()
      const bb=mesh.geometry?.boundingBox
      const T=bb?Math.max(0,bb.max.z-bb.min.z):0
      mesh.geometry?.dispose?.()
      mesh.geometry=tubeStripGeometry(f.w,f.h,T)
      // 弧面上按面片整体平滑着色，否则每一小段是一个平面
      for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        if(m&&'flatShading' in m){m.flatShading=false;m.needsUpdate=true}
        if(m&&'side' in m)m.side=THREE.DoubleSide
      }
      strips.push(mesh)
    }
    nodes.set(f.name,{name:f.name,anchor,mover,mesh,parent:f.parent||null,axis:null,side:f.side||null,finalRad:0,shift:ZERO})
  }
  const disc=nodes.get(tube.disc.name)
  // 圆片：从版面位置移到盖沿上口，同时由平放翻成水平（印刷面朝上）
  const cx=tube.rim.x+tube.rim.w/2
  const discFrom=new THREE.Vector3(tube.disc.x+tube.disc.w/2,-(tube.disc.y+tube.disc.h/2),0)
  const rimAbove=tube.rim.y<=tube.body.y
  // 版面上盖沿与筒身之间留有间隔：合拢时盖沿落到筒身上口
  const gap=Math.max(0,rimAbove?tube.body.y-(tube.rim.y+tube.rim.h):tube.rim.y-(tube.body.y+tube.body.h))
  const drop=rimAbove?-gap:gap
  const rimNode=nodes.get(tube.rim.name)
  const rimY=rimNode.anchor.position.y
  const capY=rimAbove?tube.rim.y:tube.rim.y+tube.rim.h
  const discTo=new THREE.Vector3(cx,-capY+drop,-R)
  const capTurn=rimAbove?-Math.PI/2:Math.PI/2
  function apply(t){
    const k=smoothstep(Math.max(0,Math.min(1,Number(t)||0)))
    for(const mesh of strips)bendTubeStrip(mesh.geometry,k)
    rimNode.anchor.position.y=rimY+drop*k
    disc.anchor.position.lerpVectors(discFrom,discTo,k)
    disc.anchor.rotation.set(capTurn*k,0,0)
  }
  apply(0)
  const assembly={items:[],toReference:new THREE.Matrix4(),pieceAt:()=>null,groupAt:()=>null,apply(){},verify:()=>true}
  return {root,nodes,apply,stageCount:0,assembled:true,assembly,tube:true}
}

/**
 * @param {object} knife geomMode knife（含 faces / hinges / foldStages）
 * @param {{makeMesh:(face:object)=>THREE.Object3D, zOff?:number}} opts
 */
export function buildGeomRig(knife,{makeMesh,zOff=0,verifyAssembly=true}){
  const tube=detectTube(knife)
  if(tube)return buildTubeRig(knife,tube,{makeMesh,zOff})
  const root=new THREE.Group()
  const faces=knife?.faces||[]
  const byName=Object.fromEntries(faces.map(f=>[f.name,f]))
  const hingeBy=Object.fromEntries((knife?.hinges||[]).map(h=>[h.child,h]))
  const nodes=new Map()

  const stages=Array.isArray(knife?.foldStages)?knife.foldStages:[]
  const moved=translatedFaces(stages)

  // 多层盒：每层一个分组，折好后按官方装配位姿拼成完整的盒子（展开时仍平铺在版面上）
  const assembly=assemblyGroups(knife,root)

  /** 面在刀版坐标中的累计平移；无自身平移步则随父面 */
  function worldMoves(trMap){
    const memo=new Map()
    const get=name=>{
      if(memo.has(name))return memo.get(name)
      const parent=byName[name]?.parent
      let v=ZERO
      if(moved.has(name))v=trMap.get(name)||ZERO
      else if(parent&&byName[parent])v=get(parent)
      memo.set(name,v)
      return v
    }
    return get
  }
  const finalMove=worldMoves(translationsAtProgress(stages,1))

  function attach(name){
    if(nodes.has(name))return nodes.get(name)
    const f=byName[name]
    if(!f)return null
    const parentFace=f.parent?byName[f.parent]:null
    const parentNode=parentFace?attach(f.parent):null
    const anchor=new THREE.Group()
    const mover=new THREE.Group()
    anchor.add(mover)
    const mesh=makeMesh(f)
    mover.add(mesh)
    const cx=f.x+f.w/2,cy=f.y+f.h/2
    let node
    if(!parentNode){
      anchor.position.set(cx,-cy,0)
      mesh.position.set(0,0,zOff)
      const home=assembly.groupAt(cx,cy)||root
      home.add(anchor)
      node={name,anchor,mover,mesh,parent:null,axis:null,side:null,finalRad:0,shift:ZERO}
    }else{
      const pcx=parentFace.x+parentFace.w/2,pcy=parentFace.y+parentFace.h/2
      const p=hingePivot(f,parentFace)
      const shift=isPointHinge(f)?finalMove(f.parent):ZERO
      anchor.position.set(p.x-shift.x-pcx,-(p.y-shift.y-pcy),shift.z)
      parentNode.mesh.add(anchor)
      mesh.position.set(cx-p.x,-(cy-p.y),zOff)
      const h=hingeBy[name]
      const deg=Number.isFinite(h?.angle)?h.angle:-90
      node={name,anchor,mover,mesh,parent:f.parent,axis:hingeAxis(f,h),side:f.side,finalRad:deg*Math.PI/180,shift}
    }
    nodes.set(name,node)
    return node
  }
  faces.forEach(f=>attach(f.name))

  // 与官方 3D 结果对照得出：翻转之后的平移沿翻转后的自身坐标轴进行
  const mode={frame:'local',pivot:'center',...(knife?.asmMode||{})}
  /**
   * 带整件翻转的面：把它的平移步与翻转步按动画顺序复合成一个位姿（相对该面展开时的中心）。
   * frame：平移沿图层坐标轴（layer）还是沿翻转后的自身坐标轴（local）
   * pivot：翻转绕自身当前中心（center）/ 展开时的中心（start）/ 所在图层的原点（origin）
   */
  function wholePiecePose(n,clamped){
    const m=new THREE.Matrix4()
    const count=stages.length
    const u=clamped*count
    const si=clamped>=1?count:Math.min(count-1,Math.floor(u))
    const local=clamped>=1?1:smoothstep(u-si)
    const f=byName[n.name]
    const piece=assembly.pieceAt(f.x+f.w/2,f.y+f.h/2)
    const o=piece?new THREE.Vector3(piece.x-(f.x+f.w/2),-(piece.y-(f.y+f.h/2)),0):new THREE.Vector3()
    for(let i=0;i<count;i++){
      const w=i<si?1:(i===si?local:0)
      if(w===0)continue
      for(const st of stages[i]||[]){
        if(st?.face!==n.name)continue
        if(st.move){
          const t=new THREE.Matrix4().makeTranslation(st.move.x*w,-st.move.y*w,-st.move.z*w)
          if(mode.frame==='local')m.multiply(t)
          else m.premultiply(t)
        }else if(st.spin){
          // 整件翻转的轴是成品坐标系里的方向（如绕水平轴把盖子翻面），先换算回这一层自己的刀版坐标
          const ax=new THREE.Vector3(st.spin.x,st.spin.y,st.spin.z)
          if(piece?.transform?.rotate){
            const e=piece.transform.rotate
            ax.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Number(e.x)||0,Number(e.y)||0,Number(e.z)||0,'XYZ')).invert())
          }
          const r=new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(ax.x,-ax.y,-ax.z).normalize(),st.spin.deg*w*Math.PI/180)
          if(mode.pivot==='start')m.premultiply(r)
          else if(mode.pivot==='origin'){
            m.premultiply(new THREE.Matrix4().makeTranslation(-o.x,-o.y,-o.z)).premultiply(r).premultiply(new THREE.Matrix4().makeTranslation(o.x,o.y,o.z))
          }else m.multiply(r)
        }
      }
    }
    return m
  }

  /** t∈[0,1]：按阶段回放旋转与整件平移 */
  function apply(t){
    const clamped=Math.max(0,Math.min(1,Number(t)||0))
    const angMap=anglesAtProgress(stages,clamped)
    const s=smoothstep(clamped)
    const worldMove=worldMoves(translationsAtProgress(stages,clamped))
    const spins=spinsAtProgress(stages,clamped)
    // 各层在第一步内就位（之后的步骤是官方动画里的折叠 / 平移 / 翻转）
    assembly.apply(smoothstep(clamped*Math.max(1,stages.length)),clamped*stages.length)
    for(const n of nodes.values()){
      const w=worldMove(n.name)
      const pw=n.parent?worldMove(n.parent):ZERO
      const dx=w.x-pw.x+n.shift.x,dy=w.y-pw.y+n.shift.y,dz=w.z-pw.z+n.shift.z
      n.mover.position.set(dx,-dy,-dz)
      // 整件翻转 + 平移：按动画顺序依次复合（轴与位移按刀版坐标 → 场景坐标 (x,-y,-z)）
      if(spins.has(n.name)){
        const m=wholePiecePose(n,clamped)
        m.decompose(n.mover.position,n.mover.quaternion,SCRATCH_SCALE)
        n.spun=true
      }else if(n.spun){
        n.mover.quaternion.identity()
        n.spun=false
      }
      if(!n.parent)continue
      // 有官方动画时，未出现在动画里的铰链不转（如只平移的隔板）
      let v
      if(angMap.has(n.name))v=angMap.get(n.name)
      else if(stages.length)v=0
      else v=s*n.finalRad
      if(n.axis){
        n.anchor.setRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(n.axis,v))
      }else{
        const r=foldRotation(n.side,v)
        n.anchor.rotation.set(r.x,r.y,r.z)
      }
    }
  }

  // 多层盒：装配结果与标称外尺寸对不上时退回散件视图
  const assembled=verifyAssembly?assembly.verify(apply):true

  return {root,nodes,apply,stageCount:stages.length,assembled,assembly}
}
