/**
 * Reusable folding carton mesh builder (no renderer / camera).
 * Shared by studio knifeScene and the multi-model 3D renderer.
 */
import * as THREE from 'three'
import {neutralMeshOffset, foldRotation} from '../foldSim.js'
import {anglesAtProgress} from '../foldStages.js'
import {buildGeomRig} from '../geomRig.js'
import {fold3dKnife} from '../foldRecipe.js'
import {ensureBoardPack, createBoardMaterial} from '../boardMaterial.js'

export function disposeTree(node) {
  if (!node) return
  node.traverse((o) => {
    o.geometry?.dispose()
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material]
      ms.forEach((m) => m.dispose())
    }
  })
}

function makePanelMesh(f, faceHoles, thickness, materialId) {
  const T = Number(thickness)
  const shape = new THREE.Shape()
  const cx = f.x + f.w / 2
  const cy = f.y + f.h / 2
  // outline3d: a 3D-only outline that may reach beyond the face rectangle (tongues, ears)
  const outline = Array.isArray(f.outline3d) && f.outline3d.length >= 3 ? f.outline3d : f.outline
  if (Array.isArray(outline) && outline.length >= 3) {
    outline.forEach((p, i) => {
      const x = p[0] - cx
      const y = -(p[1] - cy)
      if (i) shape.lineTo(x, y)
      else shape.moveTo(x, y)
    })
    shape.closePath()
  } else {
    shape.moveTo(-f.w / 2, -f.h / 2)
    shape.lineTo(f.w / 2, -f.h / 2)
    shape.lineTo(f.w / 2, f.h / 2)
    shape.lineTo(-f.w / 2, f.h / 2)
    shape.closePath()
  }
  for (const hole of faceHoles) {
    const loop =
      Array.isArray(hole.loop) && hole.loop.length >= 3
        ? hole.loop
        : [
            [hole.x, hole.y],
            [hole.x + hole.w, hole.y],
            [hole.x + hole.w, hole.y + hole.h],
            [hole.x, hole.y + hole.h],
          ]
    const path = new THREE.Path()
    loop.forEach((p, i) => {
      const x = p[0] - cx
      const y = -(p[1] - cy)
      if (i) path.lineTo(x, y)
      else path.moveTo(x, y)
    })
    path.closePath()
    shape.holes.push(path)
  }
  const geo = new THREE.ExtrudeGeometry(shape, {depth: T, bevelEnabled: false})
  const mat = createBoardMaterial(materialId, {flatShading: !f.smooth})
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = f.name
  mesh.userData.pickablePanel = true
  mesh.userData.faceW = f.w
  mesh.userData.faceH = f.h
  mesh.userData.boardMap = mat.map || null
  mesh.userData.boardRepeat = mat.map ? mat.map.repeat.clone() : null
  mesh.userData.boardOffset = mat.map ? mat.map.offset.clone() : null
  mesh.userData.boardWrapS = mat.map ? mat.map.wrapS : null
  mesh.userData.boardWrapT = mat.map ? mat.map.wrapT : null
  const off = neutralMeshOffset(T)
  mesh.position.z = off.z
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function applyArtworkToMesh(mesh, tex) {
  if (!mesh?.material) return
  const mat = mesh.material
  const w = Math.max(Number(mesh.userData.faceW) || 1, 1e-6)
  const h = Math.max(Number(mesh.userData.faceH) || 1, 1e-6)
  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.repeat.set(1 / w, 1 / h)
    tex.offset.set(0.5, 0.5)
    tex.needsUpdate = true
    mat.map = tex
    mat.needsUpdate = true
  } else {
    mat.map = mesh.userData.boardMap || null
    if (mat.map && mesh.userData.boardRepeat) {
      mat.map.repeat.copy(mesh.userData.boardRepeat)
      if (mesh.userData.boardOffset) mat.map.offset.copy(mesh.userData.boardOffset)
      if (mesh.userData.boardWrapS != null) mat.map.wrapS = mesh.userData.boardWrapS
      if (mesh.userData.boardWrapT != null) mat.map.wrapT = mesh.userData.boardWrapT
      mat.map.needsUpdate = true
    }
    mat.needsUpdate = true
  }
}

/**
 * @returns {{
 *   root: THREE.Group,
 *   setKnife: Function,
 *   setProgress: Function,
 *   setMaterial: Function,
 *   setArtworkMaps: Function,
 *   getMeshRoot: Function,
 *   collectPickableMeshes: Function,
 *   dispose: Function,
 * }}
 */
export function createBoxModel({materialId = 'kraft'} = {}) {
  const root = new THREE.Group()
  root.name = 'boxModelRoot'

  let group = null
  let hinges = []
  let geomRig = null
  let knife = null
  let thickness = 3
  let progress = 1
  let mid = materialId
  let buildToken = 0
  let disposed = false
  /** @type {Record<string, THREE.Texture|null>} */
  let artworkMaps = {}
  /** @type {Set<THREE.Texture>} */
  const ownedArtworkTextures = new Set()

  function disposeOwnedArtwork() {
    for (const tex of ownedArtworkTextures) {
      try {
        tex.dispose()
      } catch {
        /* ignore */
      }
    }
    ownedArtworkTextures.clear()
  }

  function applyArtworkMaps() {
    if (!group && !geomRig) return
    const meshRoot = geomRig?.root || group
    if (!meshRoot) return
    meshRoot.traverse((obj) => {
      if (!obj.isMesh || !obj.name) return
      const key = obj.name
      if (Object.prototype.hasOwnProperty.call(artworkMaps, key)) {
        applyArtworkToMesh(obj, artworkMaps[key] || null)
      } else {
        applyArtworkToMesh(obj, null)
      }
    })
  }

  function applyFold() {
    const p01 = Math.max(0, Math.min(1, Number(progress)))
    if (geomRig) {
      geomRig.apply(p01)
      return
    }
    if (!hinges.length) return
    const stages = knife?.foldStages
    const staged = Array.isArray(stages) && stages.length > 0
    const angMap = staged ? anglesAtProgress(stages, p01) : null
    const stagedKids = staged ? new Set(stages.flatMap((st) => (st || []).map((s) => s.child))) : null
    const s = p01 * p01 * (3 - 2 * p01)
    for (const h of hinges) {
      let v
      if (staged) {
        if (angMap.has(h.name)) v = angMap.get(h.name)
        else if (stagedKids.has(h.name)) v = 0
        else v = s * h.angle
      } else {
        v = s * h.angle
      }
      if (h.axis) {
        const q = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(h.axis.x, h.axis.y, h.axis.z).normalize(),
          v,
        )
        h.anchor.setRotationFromQuaternion(q)
      } else {
        const r = foldRotation(h.side, v)
        h.anchor.rotation.set(r.x, r.y, r.z)
      }
    }
  }

  function clearMesh() {
    if (group) {
      root.remove(group)
      disposeTree(group)
      group = null
    }
    hinges = []
    geomRig = null
  }

  async function rebuild() {
    if (disposed) return
    const token = ++buildToken
    try {
      await ensureBoardPack(mid)
    } catch {
      /* solid */
    }
    if (token !== buildToken || disposed) return
    clearMesh()
    group = new THREE.Group()
    group.name = 'boxMesh'
    root.add(group)
    hinges = []
    geomRig = null
    const faces = knife?.faces || []
    if (!faces.length) {
      applyFold()
      return
    }
    const byName = Object.fromEntries(faces.map((f) => [f.name, f]))
    const world = new Map()
    const holesByFace = new Map()
    for (const h of knife.holes || []) {
      if (!h?.face) continue
      if (!holesByFace.has(h.face)) holesByFace.set(h.face, [])
      holesByFace.get(h.face).push(h)
    }
    const zOff = neutralMeshOffset(thickness).z
    const panelMesh = (f) => makePanelMesh(f, holesByFace.get(f.name) || [], thickness, mid)
    // Templates that carry a fold recipe (from the reference fold animation) use the replay rig too
    const recipeKnife = knife.geomMode ? null : fold3dKnife(knife)
    if (knife.geomMode || recipeKnife) {
      geomRig = buildGeomRig(recipeKnife || knife, {makeMesh: panelMesh, zOff})
      if (recipeKnife) {
        // The replay rig places faces at sheet coordinates. Parametric knives are expected to sit
        // around the origin (root face centred), as the plain hinge tree does, so callers that
        // frame the camera on the origin keep the model in view.
        const rootFace = recipeKnife.faces.find((f) => !f.parent) || recipeKnife.faces[0]
        if (rootFace) {
          geomRig.root.position.set(-(rootFace.x + rootFace.w / 2), rootFace.y + rootFace.h / 2, 0)
        }
      }
      group.add(geomRig.root)
      applyFold()
      applyArtworkMaps()
      return
    }
    function attach(name) {
      if (world.has(name)) return world.get(name)
      const f = byName[name]
      if (!f) return null
      const mesh = panelMesh(f)
      let anchor
      if (!f.parent) {
        anchor = new THREE.Group()
        group.add(anchor)
        anchor.add(mesh)
        world.set(name, {anchor, mesh})
        return world.get(name)
      }
      const p = byName[f.parent]
      if (!p) {
        anchor = new THREE.Group()
        group.add(anchor)
        anchor.add(mesh)
        world.set(name, {anchor, mesh})
        return world.get(name)
      }
      const parent = attach(f.parent)
      if (!parent) return null
      const side = f.side
      anchor = new THREE.Group()
      const dx = f.x + f.w / 2 - (p.x + p.w / 2)
      const dy = -((f.y + f.h / 2) - (p.y + p.h / 2))
      const hingeRec = (knife.hinges || []).find((h) => h.child === name)
      let hx = 0
      let hy = 0
      let axis = null
      if (Array.isArray(f.hingeLine) && f.hingeLine.length === 2) {
        const [[ax, ay], [bx, by]] = f.hingeLine
        const mx = (ax + bx) / 2
        const my = (ay + by) / 2
        const pcx = p.x + p.w / 2
        const pcy = p.y + p.h / 2
        hx = mx - pcx
        hy = -(my - pcy)
        const dirX = bx - ax
        const dirY = -(by - ay)
        const len = Math.hypot(dirX, dirY) || 1
        axis = {x: dirX / len, y: dirY / len, z: 0}
      } else {
        if (side === 'top') hy = p.h / 2
        if (side === 'bottom') hy = -p.h / 2
        if (side === 'left') hx = -p.w / 2
        if (side === 'right') hx = p.w / 2
      }
      anchor.position.set(hx, hy, 0)
      parent.mesh.add(anchor)
      mesh.position.set(dx - hx, dy - hy, zOff)
      anchor.add(mesh)
      const deg = Number.isFinite(hingeRec?.angle) ? hingeRec.angle : -90
      hinges.push({anchor, side, axis, name, angle: (deg * Math.PI) / 180})
      world.set(name, {anchor, mesh})
      return world.get(name)
    }
    faces.forEach((f) => attach(f.name))
    applyFold()
    applyArtworkMaps()
  }

  function getMeshRoot() {
    return geomRig?.root || group
  }

  function collectPickableMeshes() {
    /** @type {THREE.Mesh[]} */
    const meshes = []
    const meshRoot = getMeshRoot()
    if (!meshRoot) return meshes
    meshRoot.traverse((obj) => {
      if (obj.isMesh && obj.userData?.pickablePanel && obj.name) meshes.push(obj)
    })
    return meshes
  }

  return {
    root,
    async setKnife(nextKnife, nextThickness, nextMaterialId) {
      knife = nextKnife
      thickness = Number(nextThickness) || 3
      if (nextMaterialId) mid = nextMaterialId
      await rebuild()
    },
    setProgress(pct) {
      progress = Math.max(0, Math.min(1, Number(pct) / 100))
      applyFold()
    },
    setMaterial(id) {
      mid = id || mid
      return rebuild()
    },
    /**
     * @param {Record<string, THREE.Texture|null>|null} maps
     * @param {{takeOwnership?: boolean}} [opts]
     */
    setArtworkMaps(maps, opts = {}) {
      if (opts.takeOwnership !== false) {
        disposeOwnedArtwork()
        if (maps) {
          for (const tex of Object.values(maps)) {
            if (tex) ownedArtworkTextures.add(tex)
          }
        }
      }
      artworkMaps = maps && typeof maps === 'object' ? {...maps} : {}
      applyArtworkMaps()
    },
    getMeshRoot,
    collectPickableMeshes,
    dispose() {
      disposed = true
      buildToken++
      clearMesh()
      disposeOwnedArtwork()
      artworkMaps = {}
      knife = null
    },
  }
}
