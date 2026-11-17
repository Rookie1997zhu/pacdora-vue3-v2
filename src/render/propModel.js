/**
 * Load a prop GLB into a Three.js group with a stable pick/dispose API.
 */
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()

/**
 * @param {{url: string}} opts
 * @returns {Promise<{
 *   root: THREE.Group,
 *   collectPickableMeshes: () => THREE.Mesh[],
 *   dispose: () => void,
 * }>}
 */
export async function createPropModel({url}) {
  if (!url) throw new Error('createPropModel: url required')
  const gltf = await loader.loadAsync(url)
  const root = new THREE.Group()
  root.name = 'propRoot'
  const scene = gltf.scene || gltf.scenes?.[0]
  if (!scene) throw new Error('createPropModel: empty gltf')
  root.add(scene)

  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })

  function collectPickableMeshes() {
    const meshes = []
    root.traverse((obj) => {
      if (obj.isMesh) meshes.push(obj)
    })
    return meshes
  }

  function dispose() {
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of mats) {
          if (!m) continue
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
            m[key]?.dispose?.()
          }
          m.dispose?.()
        }
      }
    })
    root.clear()
  }

  return {root, collectPickableMeshes, dispose}
}
