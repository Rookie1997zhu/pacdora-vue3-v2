// Reader for Pacdora's `.pda` mock-up model container, and a minimal GLB (glTF 2.0 binary) writer.
//
// .pda layout (little endian):
//   [0,300)     header: u32 a, u32 b, u32 -, text
//   [300,312)   u32 nodesOffset, u32 nodesBytes, u32 nodeCount
//   [312,..)    u16 nameLength[nodeCount], then the names (utf-8) up to nodesOffset
//   nodes       nodeCount records of nodesBytes/nodeCount bytes: f32 matrix[16], i16 geometry, i16 parent, i16 index
//   then        u32 geomTableOffset, u32 geomTableBytes, u32 geomCount
//   geom table  geomCount records: u32 posStart,posEnd,normalStart,normalEnd,uvStart,uvEnd, i32 indexStart,indexEnd
//   data        starts at geomTableOffset+geomTableBytes; the ranges above are relative to it

export function parsePda(buf) {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const dv = new DataView(ab)
  const u32 = (o) => dv.getUint32(o, true)
  let nodesOffset = u32(300)
  const nodesBytes = u32(304)
  const nodeCount = u32(308)
  if (!nodeCount || nodeCount > 4096 || nodesOffset + nodesBytes > ab.byteLength) throw new Error('not a pda file')
  const dec = new TextDecoder()
  const names = []
  let at = 312 + 2 * nodeCount
  for (let i = 0; i < nodeCount; i++) {
    const len = dv.getUint16(312 + 2 * i, true)
    names.push(dec.decode(new Uint8Array(ab, at, len)))
    at += len
  }
  const rec = nodesBytes / nodeCount
  const nodes = []
  for (let i = 0; i < nodeCount; i++) {
    const o = nodesOffset + i * rec
    const matrix = []
    for (let k = 0; k < 16; k++) matrix.push(dv.getFloat32(o + 4 * k, true))
    nodes.push({ matrix, geometry: dv.getInt16(o + 64, true), parent: dv.getInt16(o + 66, true), index: dv.getInt16(o + 68, true), name: '' })
  }
  nodes.sort((a, b) => a.index - b.index)
  nodes.forEach((n, i) => { n.name = names[i] })
  const tail = nodesOffset + nodesBytes
  const tableOffset = u32(tail)
  const tableBytes = u32(tail + 4)
  const geomCount = u32(tail + 8)
  const grec = geomCount ? tableBytes / geomCount : 0
  const dataStart = tableOffset + tableBytes
  const geometries = []
  for (let i = 0; i < geomCount; i++) {
    const o = tableOffset + i * grec
    const r = { ps: u32(o), pe: u32(o + 4), ns: u32(o + 8), ne: u32(o + 12), us: u32(o + 16), ue: u32(o + 20), is: dv.getInt32(o + 24, true), ie: dv.getInt32(o + 28, true) }
    const f32 = (s, e) => new Float32Array(ab.slice(dataStart + s, dataStart + e))
    const position = f32(r.ps, r.pe)
    const normal = f32(r.ns, r.ne)
    const uv = f32(r.us, r.ue)
    let index = null
    if (r.is > -1 && r.ie > -1) {
      const raw = ab.slice(dataStart + r.is, dataStart + r.ie)
      index = position.length / 3 < 65536 ? new Uint16Array(raw) : new Uint32Array(raw)
    }
    geometries.push({ position, normal, uv, index })
  }
  return { nodes, geometries }
}

/** Minimal GLB: one mesh per geometry, node hierarchy with matrices, one shared default material. */
export function pdaToGlb(model, { generator = 'boxcraft-mockup-import' } = {}) {
  const chunks = []
  let byteLength = 0
  const bufferViews = []
  const accessors = []
  function push(typed, target) {
    const pad = (4 - (byteLength % 4)) % 4
    if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad }
    const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: b.length, ...(target ? { target } : {}) })
    chunks.push(b)
    byteLength += b.length
    return bufferViews.length - 1
  }
  // Compact encoding (KHR_mesh_quantization): int16 positions, int8 normals, uint16 UVs, and
  // identical vertices welded. The position scale/offset goes into the node matrix.
  const dequant = []
  const meshes = model.geometries.map((g) => {
    const count = g.position.length / 3
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < g.position.length; i += 3) for (let k = 0; k < 3; k++) {
      const v = g.position[i + k]
      if (v < min[k]) min[k] = v
      if (v > max[k]) max[k] = v
    }
    const center = min.map((v, k) => (v + max[k]) / 2)
    const half = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1
    const step = half / 32767
    dequant.push({ center, step })
    const hasN = g.normal.length === g.position.length
    const hasUv = g.uv.length / 2 === count
    let uvUnit = hasUv
    if (hasUv) for (let i = 0; i < g.uv.length; i++) if (!(g.uv[i] >= 0 && g.uv[i] <= 1)) { uvUnit = false; break }
    const P = new Int16Array(count * 4)
    const N = new Int8Array(count * 4)
    const U = uvUnit ? new Uint16Array(count * 2) : new Float32Array(count * 2)
    const remap = new Uint32Array(count)
    const seen = new Map()
    let n = 0
    for (let i = 0; i < count; i++) {
      const px = Math.round((g.position[3 * i] - center[0]) / step)
      const py = Math.round((g.position[3 * i + 1] - center[1]) / step)
      const pz = Math.round((g.position[3 * i + 2] - center[2]) / step)
      const nx = hasN ? Math.round(g.normal[3 * i] * 127) : 0
      const ny = hasN ? Math.round(g.normal[3 * i + 1] * 127) : 0
      const nz = hasN ? Math.round(g.normal[3 * i + 2] * 127) : 0
      const u = hasUv ? (uvUnit ? Math.round(g.uv[2 * i] * 65535) : g.uv[2 * i]) : 0
      const v = hasUv ? (uvUnit ? Math.round(g.uv[2 * i + 1] * 65535) : g.uv[2 * i + 1]) : 0
      const key = `${px},${py},${pz},${nx},${ny},${nz},${u},${v}`
      let id = seen.get(key)
      if (id === undefined) {
        id = n++
        seen.set(key, id)
        P[4 * id] = px; P[4 * id + 1] = py; P[4 * id + 2] = pz
        N[4 * id] = nx; N[4 * id + 1] = ny; N[4 * id + 2] = nz
        U[2 * id] = u; U[2 * id + 1] = v
      }
      remap[i] = id
    }
    const qmin = [32767, 32767, 32767]
    const qmax = [-32767, -32767, -32767]
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
      const q = P[4 * i + k]
      if (q < qmin[k]) qmin[k] = q
      if (q > qmax[k]) qmax[k] = q
    }
    const srcCount = g.index ? g.index.length : count
    const index = n < 65536 ? new Uint16Array(srcCount) : new Uint32Array(srcCount)
    for (let i = 0; i < srcCount; i++) index[i] = remap[g.index ? g.index[i] : i]
    const view = (typed, stride, target) => {
      const id = push(typed, target)
      if (stride) bufferViews[id].byteStride = stride
      return id
    }
    const attributes = {}
    accessors.push({ bufferView: view(P.subarray(0, n * 4), 8, 34962), componentType: 5122, count: n, type: 'VEC3', min: qmin, max: qmax })
    attributes.POSITION = accessors.length - 1
    if (hasN) {
      accessors.push({ bufferView: view(N.subarray(0, n * 4), 4, 34962), componentType: 5120, normalized: true, count: n, type: 'VEC3' })
      attributes.NORMAL = accessors.length - 1
    }
    if (hasUv) {
      accessors.push(uvUnit
        ? { bufferView: view(U.subarray(0, n * 2), 4, 34962), componentType: 5123, normalized: true, count: n, type: 'VEC2' }
        : { bufferView: view(U.subarray(0, n * 2), 8, 34962), componentType: 5126, count: n, type: 'VEC2' })
      attributes.TEXCOORD_0 = accessors.length - 1
    }
    accessors.push({ bufferView: push(index, 34963), componentType: index instanceof Uint16Array ? 5123 : 5125, count: index.length, type: 'SCALAR' })
    return { primitives: [{ attributes, material: 0, indices: accessors.length - 1 }] }
  })
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const isIdentity = (m) => !m.some((v, i) => Math.abs(v - identity[i]) > 1e-7)
  // column-major a × b
  const mul = (a, b) => {
    const o = new Array(16).fill(0)
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
    return o
  }
  const hasChildren = new Set(model.nodes.filter((n) => n.parent > -1).map((n) => n.parent))
  const nodes = model.nodes.map((n) => ({ name: n.name }))
  const roots = []
  model.nodes.forEach((n, i) => {
    if (n.parent > -1 && nodes[n.parent]) (nodes[n.parent].children ||= []).push(i)
    else roots.push(i)
  })
  model.nodes.forEach((n, i) => {
    const out = nodes[i]
    if (!(n.geometry > -1 && meshes[n.geometry])) {
      if (!isIdentity(n.matrix)) out.matrix = n.matrix
      return
    }
    const { center, step } = dequant[n.geometry]
    const local = [step, 0, 0, 0, 0, step, 0, 0, 0, 0, step, 0, center[0], center[1], center[2], 1]
    if (hasChildren.has(i)) {
      // keep the children out of the de-quantisation scale: the mesh goes on a leaf of its own
      if (!isIdentity(n.matrix)) out.matrix = n.matrix
      out.name = `${n.name}#group`
      nodes.push({ name: n.name, mesh: n.geometry, matrix: local })
      ;(out.children ||= []).push(nodes.length - 1)
    } else {
      out.mesh = n.geometry
      out.matrix = mul(n.matrix, local)
    }
  })
  const json = {
    asset: { version: '2.0', generator },
    extensionsUsed: ['KHR_mesh_quantization'],
    extensionsRequired: ['KHR_mesh_quantization'],
    scene: 0,
    scenes: [{ nodes: roots }],
    nodes,
    meshes,
    materials: [{ name: 'paper', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.85 }, doubleSided: true }],
    accessors,
    bufferViews,
    buffers: [{ byteLength }],
  }
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)])
  let bin = Buffer.concat(chunks)
  if (bin.length % 4) bin = Buffer.concat([bin, Buffer.alloc(4 - (bin.length % 4))])
  json.buffers[0].byteLength = bin.length
  jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)])
  const head = Buffer.alloc(12)
  head.writeUInt32LE(0x46546c67, 0)
  head.writeUInt32LE(2, 4)
  head.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8)
  const jh = Buffer.alloc(8)
  jh.writeUInt32LE(jsonBuf.length, 0)
  jh.writeUInt32LE(0x4e4f534a, 4)
  const bh = Buffer.alloc(8)
  bh.writeUInt32LE(bin.length, 0)
  bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([head, jh, jsonBuf, bh, bin])
}

/** Summary used for logging / manifests */
export function describePda(model) {
  let verts = 0
  let tris = 0
  for (const g of model.geometries) {
    verts += g.position.length / 3
    tris += (g.index ? g.index.length : g.position.length / 3) / 3
  }
  return { nodes: model.nodes.length, meshes: model.nodes.filter((n) => n.geometry > -1).map((n) => n.name), verts, tris: Math.round(tris) }
}
