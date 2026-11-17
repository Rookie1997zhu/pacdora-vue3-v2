/**
 * Multi-model 3D renderer scene engine (preview only; cloud render uses exported GLB).
 */
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {TransformControls} from 'three/addons/controls/TransformControls.js'
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js'
import {createBoxModel} from './boxModel.js'
import {createPropModel} from './propModel.js'
import {LIGHT_PRESET_DEFAULTS, sunDirectionFromAngles} from './lightPresets.js'
import {ASPECT_RATIOS} from '../../packages/render-scene-schema/renderScene'

/**
 * @typedef {import('../../packages/render-scene-schema/renderScene').RenderSceneDocumentV2} RenderSceneDocumentV2
 * @typedef {import('../../packages/render-scene-schema/renderScene').RenderSceneModelV2} RenderSceneModelV2
 * @typedef {import('../../packages/render-scene-schema/renderScene').RenderScenePropV2} RenderScenePropV2
 */

/**
 * @param {HTMLElement} container
 * @param {{
 *   onSelectModel?: (id: string|null) => void,
 *   onSelectProp?: (id: string|null) => void,
 *   onTransformChange?: () => void,
 *   onCameraChange?: () => void,
 * }} [opts]
 */
export function createRenderScene(container, opts = {}) {
  if (!container) throw new Error('createRenderScene: container required')

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 8000)
  camera.position.set(420, 320, 420)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const roomEnv = new RoomEnvironment()
  let envRT = pmrem.fromScene(roomEnv, 0.04)
  scene.environment = envRT.texture
  roomEnv.dispose?.()
  /** @type {THREE.Texture|null} */
  let hdrTexture = null
  let hdrUrlLoaded = ''

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb0b4bc, 0.55)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = 2500
  sun.shadow.camera.left = -600
  sun.shadow.camera.right = 600
  sun.shadow.camera.top = 600
  sun.shadow.camera.bottom = -600
  sun.shadow.bias = -0.0002
  scene.add(sun)
  scene.add(sun.target)

  const groundGeo = new THREE.PlaneGeometry(4000, 4000)
  const groundMat = new THREE.ShadowMaterial({opacity: 0.45})
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  ground.receiveShadow = true
  ground.name = '__ground'
  scene.add(ground)

  const modelsRoot = new THREE.Group()
  modelsRoot.name = '__models'
  scene.add(modelsRoot)

  const propsRoot = new THREE.Group()
  propsRoot.name = '__props'
  scene.add(propsRoot)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = 80
  controls.maxDistance = 4000
  controls.target.set(0, 40, 0)

  const transform = new TransformControls(camera, renderer.domElement)
  transform.setSize(0.85)
  transform.addEventListener('dragging-changed', (ev) => {
    controls.enabled = !ev.value
  })
  transform.addEventListener('objectChange', () => {
    if (typeof opts.onTransformChange === 'function') opts.onTransformChange()
  })
  scene.add(transform.getHelper())

  /** @type {Map<string, {entry: object, box: ReturnType<typeof createBoxModel>, wrapper: THREE.Group}>} */
  const models = new Map()
  /** @type {Map<string, {entry: object, prop: Awaited<ReturnType<typeof createPropModel>>, wrapper: THREE.Group}>} */
  const props = new Map()
  let selectedId = null
  let selectedKind = /** @type {'model'|'prop'|null} */ (null)
  let disposed = false
  let raf = 0
  let transformMode = 'translate'
  /** @type {RenderSceneDocumentV2|null} */
  let lastDoc = null

  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  /** @type {{x:number,y:number}|null} */
  let pointerDown = null
  const CLICK_PX = 5
  const rgbeLoader = new RGBELoader()

  function applyBackground(doc) {
    const env = doc?.environment
    if (env?.useAsBackground && scene.environment && !scene.environment.isRenderTargetTexture === false) {
      // When HDR is used as background, prefer env map background if we have HDR texture.
      if (hdrTexture) {
        if (scene.background && scene.background.isTexture && scene.background !== hdrTexture) {
          scene.background.dispose?.()
        }
        scene.background = hdrTexture
        return
      }
    }
    const bg = doc?.background
    if (!bg) {
      scene.background = new THREE.Color(0xf5f6f8)
      return
    }
    if (bg.type === 'gradient') {
      const top = bg.gradient?.top || '#EEF1F5'
      const bottom = bg.gradient?.bottom || '#D8DEE8'
      const c = document.createElement('canvas')
      c.width = 2
      c.height = 256
      const ctx = c.getContext('2d')
      const g = ctx.createLinearGradient(0, 0, 0, 256)
      g.addColorStop(0, top)
      g.addColorStop(1, bottom)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 2, 256)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      if (scene.background && scene.background.isTexture && scene.background !== hdrTexture) {
        scene.background.dispose()
      }
      scene.background = tex
    } else {
      if (scene.background && scene.background.isTexture && scene.background !== hdrTexture) {
        scene.background.dispose()
      }
      scene.background = new THREE.Color(bg.color || '#F5F6F8')
    }
  }

  function applyLight(doc) {
    const light = doc?.light || LIGHT_PRESET_DEFAULTS.softbox
    const preset = LIGHT_PRESET_DEFAULTS[light.preset] || LIGHT_PRESET_DEFAULTS.softbox
    const dir = sunDirectionFromAngles(light.sunPhi ?? preset.sunPhi, light.sunTheta ?? preset.sunTheta)
    sun.position.set(dir.x, dir.y, dir.z)
    sun.target.position.set(0, 0, 0)
    sun.intensity = Number(light.sunIntensity ?? preset.sunIntensity)
    sun.color.setHex(preset.color || 0xffffff)
    hemi.intensity = Number(light.envIntensity ?? preset.envIntensity)
    const envIntensity = Number(doc?.environment?.intensity ?? light.envIntensity ?? preset.envIntensity)
    scene.environmentIntensity = envIntensity
  }

  function applyGround(doc) {
    const g = doc?.ground
    ground.visible = g?.visible !== false
    groundMat.opacity = Math.max(0, Math.min(1, Number(g?.shadowIntensity ?? 0.45)))
  }

  function applyCamera(doc) {
    const cam = doc?.camera
    if (!cam) return
    if (cam.position) camera.position.set(cam.position.x, cam.position.y, cam.position.z)
    if (cam.target) controls.target.set(cam.target.x, cam.target.y, cam.target.z)
    if (cam.fov) {
      camera.fov = cam.fov
      camera.updateProjectionMatrix()
    }
    controls.update()
  }

  function applyAspect(doc) {
    void doc
  }

  /**
   * @param {RenderSceneDocumentV2} doc
   * @param {{resolveHdrUrl?: (hdrId: string) => string|null|Promise<string|null>}} [helpers]
   */
  async function applyEnvironment(doc, helpers = {}) {
    const env = doc?.environment
    const hdrId = env?.hdrId || null
    if (!hdrId) {
      if (hdrTexture) {
        // keep room env
        if (envRT) {
          scene.environment = envRT.texture
        }
        hdrUrlLoaded = ''
      }
      return
    }
    const resolve = helpers.resolveHdrUrl
    if (!resolve) return
    const url = await resolve(hdrId)
    if (!url || url === hdrUrlLoaded) {
      if (url && env) {
        scene.environmentIntensity = Number(env.intensity ?? 1)
      }
      return
    }
    try {
      const tex = await rgbeLoader.loadAsync(url)
      tex.mapping = THREE.EquirectangularReflectionMapping
      const rt = pmrem.fromEquirectangular(tex)
      scene.environment = rt.texture
      if (hdrTexture && hdrTexture !== tex) hdrTexture.dispose?.()
      hdrTexture = tex
      hdrUrlLoaded = url
      scene.environmentIntensity = Number(env?.intensity ?? 1)
      // Apply yaw via scene.environmentRotation if available (r163+)
      if ('environmentRotation' in scene) {
        scene.environmentRotation.y = (Number(env?.rotation || 0) * Math.PI) / 180
      }
    } catch (err) {
      console.warn('HDR load failed', hdrId, err)
    }
  }

  function syncWrapperFromEntry(wrapper, entry) {
    wrapper.position.set(entry.position.x, entry.position.y, entry.position.z)
    wrapper.rotation.set(entry.rotation.x, entry.rotation.y, entry.rotation.z)
    const s = Number(entry.scale) || 1
    wrapper.scale.set(s, s, s)
  }

  function readEntryFromWrapper(wrapper, entry) {
    entry.position = {x: wrapper.position.x, y: wrapper.position.y, z: wrapper.position.z}
    entry.rotation = {x: wrapper.rotation.x, y: wrapper.rotation.y, z: wrapper.rotation.z}
    entry.scale = wrapper.scale.x
  }

  function setSelected(id, kind = 'model') {
    selectedId = id || null
    selectedKind = selectedId ? kind : null
    if (!selectedId) {
      transform.detach()
    } else if (kind === 'prop' && props.has(selectedId)) {
      transform.attach(props.get(selectedId).wrapper)
      transform.setMode(transformMode)
    } else if (kind === 'model' && models.has(selectedId)) {
      transform.attach(models.get(selectedId).wrapper)
      transform.setMode(transformMode)
    } else {
      transform.detach()
      selectedId = null
      selectedKind = null
    }
    if (typeof opts.onSelectModel === 'function') {
      opts.onSelectModel(selectedKind === 'model' ? selectedId : null)
    }
    if (typeof opts.onSelectProp === 'function') {
      opts.onSelectProp(selectedKind === 'prop' ? selectedId : null)
    }
  }

  /**
   * @param {RenderSceneModelV2} entry
   * @param {{knife: any, thicknessMm?: number, artworkMaps?: Record<string, THREE.Texture|null>}} payload
   */
  async function upsertModel(entry, payload) {
    if (!entry?.id) throw new Error('upsertModel: entry.id required')
    let rec = models.get(entry.id)
    if (!rec) {
      const box = createBoxModel({materialId: entry.materialId || 'kraft'})
      const wrapper = new THREE.Group()
      wrapper.name = `model:${entry.id}`
      wrapper.userData.modelId = entry.id
      wrapper.userData.kind = 'model'
      wrapper.add(box.root)
      modelsRoot.add(wrapper)
      rec = {entry: {...entry}, box, wrapper}
      models.set(entry.id, rec)
    } else {
      rec.entry = {...entry}
    }
    syncWrapperFromEntry(rec.wrapper, rec.entry)
    await rec.box.setKnife(payload.knife, payload.thicknessMm ?? 3, entry.materialId || 'kraft')
    rec.box.setProgress(entry.foldProgress ?? 100)
    if (payload.artworkMaps) {
      rec.box.setArtworkMaps(payload.artworkMaps, {takeOwnership: true})
    }
    return rec
  }

  /**
   * @param {RenderScenePropV2} entry
   * @param {{url: string}} payload
   */
  async function upsertProp(entry, payload) {
    if (!entry?.id) throw new Error('upsertProp: entry.id required')
    let rec = props.get(entry.id)
    if (rec) {
      propsRoot.remove(rec.wrapper)
      rec.prop.dispose()
      props.delete(entry.id)
    }
    const prop = await createPropModel({url: payload.url})
    const wrapper = new THREE.Group()
    wrapper.name = `prop:${entry.id}`
    wrapper.userData.propId = entry.id
    wrapper.userData.kind = 'prop'
    wrapper.add(prop.root)
    propsRoot.add(wrapper)
    rec = {entry: {...entry}, prop, wrapper}
    props.set(entry.id, rec)
    syncWrapperFromEntry(rec.wrapper, rec.entry)
    return rec
  }

  function removeModel(id) {
    const rec = models.get(id)
    if (!rec) return
    if (selectedId === id && selectedKind === 'model') setSelected(null)
    modelsRoot.remove(rec.wrapper)
    rec.box.dispose()
    models.delete(id)
  }

  function removeProp(id) {
    const rec = props.get(id)
    if (!rec) return
    if (selectedId === id && selectedKind === 'prop') setSelected(null)
    propsRoot.remove(rec.wrapper)
    rec.prop.dispose()
    props.delete(id)
  }

  function clearModels() {
    for (const id of [...models.keys()]) removeModel(id)
  }

  function clearProps() {
    for (const id of [...props.keys()]) removeProp(id)
  }

  /**
   * @param {RenderSceneDocumentV2} doc
   * @param {{resolveHdrUrl?: (hdrId: string) => string|null|Promise<string|null>}} [helpers]
   */
  async function applyDocumentEnv(doc, helpers = {}) {
    lastDoc = doc
    await applyEnvironment(doc, helpers)
    applyBackground(doc)
    applyLight(doc)
    applyGround(doc)
    applyCamera(doc)
    applyAspect(doc)
  }

  function updateModelEntry(id, patch) {
    const rec = models.get(id)
    if (!rec) return null
    Object.assign(rec.entry, patch)
    if (patch.position || patch.rotation || patch.scale != null) {
      syncWrapperFromEntry(rec.wrapper, rec.entry)
    }
    if (patch.foldProgress != null) rec.box.setProgress(patch.foldProgress)
    if (patch.materialId) void rec.box.setMaterial(patch.materialId)
    return rec.entry
  }

  function updatePropEntry(id, patch) {
    const rec = props.get(id)
    if (!rec) return null
    Object.assign(rec.entry, patch)
    if (patch.position || patch.rotation || patch.scale != null) {
      syncWrapperFromEntry(rec.wrapper, rec.entry)
    }
    return rec.entry
  }

  function getModelEntries() {
    const out = []
    for (const rec of models.values()) {
      readEntryFromWrapper(rec.wrapper, rec.entry)
      out.push({...rec.entry})
    }
    return out
  }

  function getPropEntries() {
    const out = []
    for (const rec of props.values()) {
      readEntryFromWrapper(rec.wrapper, rec.entry)
      out.push({...rec.entry})
    }
    return out
  }

  function captureCamera() {
    return {
      position: {x: camera.position.x, y: camera.position.y, z: camera.position.z},
      target: {x: controls.target.x, y: controls.target.y, z: controls.target.z},
      fov: camera.fov,
    }
  }

  function setTransformMode(mode) {
    transformMode = mode === 'rotate' || mode === 'scale' ? mode : 'translate'
    if (transform.object) transform.setMode(transformMode)
  }

  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointerNdc, camera)
    const meshes = []
    for (const rec of models.values()) {
      for (const m of rec.box.collectPickableMeshes()) meshes.push(m)
    }
    for (const rec of props.values()) {
      for (const m of rec.prop.collectPickableMeshes()) meshes.push(m)
    }
    const hits = raycaster.intersectObjects(meshes, false)
    for (const hit of hits) {
      let obj = hit.object
      while (obj) {
        if (obj.userData?.modelId) return {id: obj.userData.modelId, kind: 'model'}
        if (obj.userData?.propId) return {id: obj.userData.propId, kind: 'prop'}
        obj = obj.parent
      }
    }
    return null
  }

  function onPointerDown(ev) {
    if (ev.button != null && ev.button !== 0) return
    if (transform.dragging) return
    pointerDown = {x: ev.clientX, y: ev.clientY}
  }

  function onPointerUp(ev) {
    if (ev.button != null && ev.button !== 0) {
      pointerDown = null
      return
    }
    if (!pointerDown || transform.dragging) {
      pointerDown = null
      return
    }
    const dx = ev.clientX - pointerDown.x
    const dy = ev.clientY - pointerDown.y
    pointerDown = null
    if (dx * dx + dy * dy > CLICK_PX * CLICK_PX) return
    const hit = pickAt(ev.clientX, ev.clientY)
    if (!hit) setSelected(null)
    else setSelected(hit.id, hit.kind)
  }

  function resize() {
    if (!container || disposed) return
    const r = container.getBoundingClientRect()
    if (!r.width || !r.height) return
    renderer.setSize(r.width, r.height)
    camera.aspect = r.width / r.height
    camera.updateProjectionMatrix()
  }

  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  const canvas = renderer.domElement
  canvas.style.touchAction = 'none'
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerUp)

  controls.addEventListener('end', () => {
    if (typeof opts.onCameraChange === 'function') opts.onCameraChange()
  })

  const draw = () => {
    if (disposed) return
    raf = requestAnimationFrame(draw)
    controls.update()
    renderer.render(scene, camera)
  }
  draw()

  async function snapshot(size = {}) {
    const prevW = renderer.domElement.width
    const prevH = renderer.domElement.height
    const aspect = lastDoc?.output?.aspect
    const ratio = ASPECT_RATIOS[aspect] || camera.aspect || 1
    const w = Math.max(64, Math.min(4096, Number(size.width) || 512))
    const h = Math.max(64, Math.min(4096, Number(size.height) || Math.round(w / ratio)))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    const blob = await new Promise((resolve) => renderer.domElement.toBlob(resolve, 'image/png'))
    renderer.setSize(prevW, prevH, false)
    resize()
    return blob
  }

  function exportGlb() {
    return new Promise((resolve, reject) => {
      const exporter = new GLTFExporter()
      const exportRoot = new THREE.Group()
      exportRoot.name = 'boxcraft_render_export'
      for (const rec of models.values()) {
        readEntryFromWrapper(rec.wrapper, rec.entry)
        exportRoot.add(rec.wrapper.clone(true))
      }
      for (const rec of props.values()) {
        readEntryFromWrapper(rec.wrapper, rec.entry)
        exportRoot.add(rec.wrapper.clone(true))
      }
      exporter.parse(
        exportRoot,
        (result) => {
          if (result instanceof ArrayBuffer) resolve(result)
          else resolve(new TextEncoder().encode(JSON.stringify(result)).buffer)
        },
        (err) => reject(err),
        {binary: true, onlyVisible: true, embedImages: true, maxTextureSize: 2048},
      )
    })
  }

  return {
    applyDocumentEnv,
    upsertModel,
    upsertProp,
    removeModel,
    removeProp,
    clearModels,
    clearProps,
    updateModelEntry,
    updatePropEntry,
    getModelEntries,
    getPropEntries,
    getSelectedId: () => selectedId,
    getSelectedKind: () => selectedKind,
    setSelected,
    setTransformMode,
    captureCamera,
    snapshot,
    exportGlb,
    resetView() {
      const box = new THREE.Box3()
      box.setFromObject(modelsRoot)
      const box2 = new THREE.Box3().setFromObject(propsRoot)
      if (!box2.isEmpty()) box.union(box2)
      const center = new THREE.Vector3()
      const sphere = new THREE.Sphere()
      if (box.isEmpty()) {
        center.set(0, 40, 0)
        sphere.radius = 200
      } else {
        box.getCenter(center)
        box.getBoundingSphere(sphere)
      }
      const r = Math.max(sphere.radius, 40)
      const dist = (r / Math.sin((camera.fov * Math.PI) / 180 / 2)) * 1.2
      const dir = new THREE.Vector3(0.75, 0.55, 0.85).normalize()
      camera.position.copy(center).addScaledVector(dir, dist)
      controls.target.copy(center)
      controls.update()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      transform.detach()
      transform.dispose?.()
      controls.dispose()
      clearModels()
      clearProps()
      if (scene.background && scene.background.isTexture && scene.background !== hdrTexture) {
        scene.background.dispose()
      }
      hdrTexture?.dispose?.()
      groundGeo.dispose()
      groundMat.dispose()
      envRT.texture?.dispose?.()
      envRT.dispose?.()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
