/**
 * ambientCG 纸板/纸纹 PBR：
 * - kraft / 瓦楞感：Cardboard002
 * - white（白卡/艺术纸涂层感）：Paper001 + 高亮低粗糙
 * - blue：Paper001 + 冷色 tint、略粗颗粒
 * ExtrudeGeometry UV 单位为 mm，用 texture.repeat=1/tileMm 平铺。
 */
import * as THREE from 'three'
import {publicAssetUrl} from './assetUrl.js'

const FALLBACK={
  kraft:0xc6a47a,
  white:0xf7f4ec,
  blue:0x7e9bbd,
  matte_white:0xf4f2ec,
  glossy_white:0xffffff,
  kraft_dark:0x8b6844,
  black:0x222222
}

/** @type {Record<string,{dir:string,prefix:string,tint:number,roughness:number,tileMm:number,normalScale:number,metalness?:number}>} */
const SPECS={
  kraft:{
    dir:'Cardboard002_1K-JPG',
    prefix:'Cardboard002_1K-JPG',
    tint:0xffffff,
    roughness:.92,
    tileMm:140,
    normalScale:.55
  },
  white:{
    dir:'Paper001_1K-JPG',
    prefix:'Paper001_1K-JPG',
    tint:0xfffdf8,
    roughness:.62,
    tileMm:85,
    normalScale:.22,
    metalness:.02
  },
  blue:{
    dir:'Paper001_1K-JPG',
    prefix:'Paper001_1K-JPG',
    tint:0x8aa6c8,
    roughness:.84,
    tileMm:110,
    normalScale:.4
  },
  matte_white:{
    dir:'Paper001_1K-JPG',
    prefix:'Paper001_1K-JPG',
    tint:0xf2f0ea,
    roughness:.88,
    tileMm:90,
    normalScale:.18,
    metalness:0
  },
  glossy_white:{
    dir:'Paper001_1K-JPG',
    prefix:'Paper001_1K-JPG',
    tint:0xffffff,
    roughness:.28,
    tileMm:80,
    normalScale:.12,
    metalness:.08
  },
  kraft_dark:{
    dir:'Cardboard002_1K-JPG',
    prefix:'Cardboard002_1K-JPG',
    tint:0xb8895c,
    roughness:.95,
    tileMm:140,
    normalScale:.6
  },
  black:{
    dir:'Paper001_1K-JPG',
    prefix:'Paper001_1K-JPG',
    tint:0x2a2a2a,
    roughness:.55,
    tileMm:100,
    normalScale:.2,
    metalness:.05
  }
}

export const BOARD_MATERIAL_IDS=Object.keys(SPECS)

const loader=new THREE.TextureLoader()
/** @type {Map<string,Promise<{map:THREE.Texture,normalMap:THREE.Texture,roughnessMap:THREE.Texture}>>} */
const inflight=new Map()
/** @type {Map<string,{map:THREE.Texture,normalMap:THREE.Texture,roughnessMap:THREE.Texture}>} */
const settled=new Map()

function resolveId(materialId){
  return SPECS[materialId]?materialId:'kraft'
}

function packKey(materialId){
  const s=SPECS[resolveId(materialId)]
  return `${s.dir}|${s.tileMm}`
}

function loadMap(url,{color=false,repeat=1}={}){
  return new Promise((resolve,reject)=>{
    loader.load(
      url,
      tex=>{
        tex.wrapS=tex.wrapT=THREE.RepeatWrapping
        tex.repeat.set(repeat,repeat)
        tex.anisotropy=4
        tex.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace
        tex.needsUpdate=true
        resolve(tex)
      },
      undefined,
      err=>reject(err||new Error(`texture load failed: ${url}`))
    )
  })
}

/**
 * 预加载材质包（可重复调用，结果缓存）。
 * @param {string} [materialId]
 */
export function ensureBoardPack(materialId='kraft'){
  const id=resolveId(materialId)
  const key=packKey(id)
  if(settled.has(key))return Promise.resolve(settled.get(key))
  if(inflight.has(key))return inflight.get(key)

  const s=SPECS[id]
  const base=publicAssetUrl(`materials/${s.dir}/${s.prefix}`)
  const repeat=1/s.tileMm
  const p=Promise.all([
    loadMap(`${base}_Color.jpg`,{color:true,repeat}),
    loadMap(`${base}_NormalGL.jpg`,{repeat}),
    loadMap(`${base}_Roughness.jpg`,{repeat})
  ]).then(([map,normalMap,roughnessMap])=>{
    const maps={map,normalMap,roughnessMap}
    settled.set(key,maps)
    inflight.delete(key)
    return maps
  }).catch(err=>{
    inflight.delete(key)
    console.warn('board material pack failed',id,err)
    throw err
  })
  inflight.set(key,p)
  return p
}

/**
 * 创建板材材质。贴图未就绪时退回纯色。
 * @param {string} [materialId]
 * @param {{flatShading?:boolean}} [opts]
 */
export function createBoardMaterial(materialId='kraft',{flatShading=false}={}){
  const id=resolveId(materialId)
  const s=SPECS[id]
  const maps=settled.get(packKey(id))
  if(!maps){
    return new THREE.MeshStandardMaterial({
      color:FALLBACK[id]??FALLBACK.kraft,
      side:THREE.DoubleSide,
      roughness:s.roughness,
      metalness:s.metalness||0,
      flatShading
    })
  }
  return new THREE.MeshStandardMaterial({
    color:s.tint,
    map:maps.map,
    normalMap:maps.normalMap,
    normalScale:new THREE.Vector2(s.normalScale,s.normalScale),
    roughnessMap:maps.roughnessMap,
    roughness:s.roughness,
    metalness:s.metalness||0,
    side:THREE.DoubleSide,
    flatShading
  })
}
