const EPS = 1e-6

function faceMap(knife) {
  return new Map(knife.faces.map((f) => [f.name, f]))
}

function scaleStroke(sx, sy) {
  return Math.min(sx, sy)
}

/**
 * Fingerprint of geometry that drives panel layout (client-side; may differ from server geometryHash until save).
 */
export function geometryFingerprint(doc) {
  if (!doc?.geometry) return ''
  const p = doc.geometry.params || {}
  return [
    doc.geometry.templateId || '',
    p.lengthMm,
    p.widthMm,
    p.heightMm,
    p.thicknessMm,
    p.bleedInputMm,
    p.sizeMode,
    p.fluteDirection,
  ].join('|')
}

/**
 * After knife rebuild: mark missing panels / stretched artwork.
 * @param {object[]} layers
 * @param {object} newKnife
 * @param {string} nextHash fingerprint after change
 */
export function annotateLayerAdapt(layers, newKnife, nextHash) {
  const faces = faceMap(newKnife)
  return (layers || []).map((layer) => {
    const panelId = layer.panelId
    if (panelId && !faces.has(panelId)) {
      return { ...layer, adaptStatus: 'needs_rebind' }
    }
    const prev = layer.sourceGeometryHash || null
    if (prev && nextHash && prev !== nextHash) {
      const stretchy = layer.kind === 'image' || layer.resizePolicy === 'scale_with_panel'
      if (stretchy) {
        return { ...layer, adaptStatus: 'needs_adapt' }
      }
    }
    return layer
  })
}

/**
 * Migrate artwork layers from old face bboxes to new ones by resizePolicy.
 * Operates in panel-local mm (relative to face top-left, y down).
 * Also annotates adaptStatus / preserves missing-panel layers.
 */
export function migrateLayers(layers, oldKnife, newKnife, nextHash = null) {
  const oldFaces = faceMap(oldKnife)
  const newFaces = faceMap(newKnife)

  const migrated = layers.map((layer) => {
    const panelId = layer.panelId
    if (!panelId) return layer
    const oldF = oldFaces.get(panelId)
    const newF = newFaces.get(panelId)
    if (!newF) {
      return { ...layer, adaptStatus: 'needs_rebind' }
    }
    if (!oldF) return layer

    const sx = newF.w / Math.max(oldF.w, EPS)
    const sy = newF.h / Math.max(oldF.h, EPS)
    const policy = layer.resizePolicy || 'keep_mm'

    let next = layer
    if (policy === 'keep_mm') {
      next = layer
    } else if (policy === 'scale_with_panel') {
      const k = scaleStroke(sx, sy)
      next = {
        ...layer,
        transform: {
          ...layer.transform,
          xMm: layer.transform.xMm * sx,
          yMm: layer.transform.yMm * sy,
        },
        widthMm: Math.max(0.1, layer.widthMm * sx),
        heightMm: Math.max(0.1, layer.heightMm * sy),
      }
      if (layer.text) {
        next.text = {
          ...layer.text,
          fontSizeMm: Math.max(0.5, layer.text.fontSizeMm * k),
        }
      }
      if (layer.shape) {
        next.shape = {
          ...layer.shape,
          strokeWidthMm: Math.max(0, layer.shape.strokeWidthMm * k),
        }
      }
    } else {
      const ax = layer.anchor?.x ?? 0
      const ay = layer.anchor?.y ?? 0
      const pinOldX = layer.transform.xMm + ax * layer.widthMm
      const pinOldY = layer.transform.yMm + ay * layer.heightMm
      const pinNewX = (pinOldX / Math.max(oldF.w, EPS)) * newF.w
      const pinNewY = (pinOldY / Math.max(oldF.h, EPS)) * newF.h
      next = {
        ...layer,
        transform: {
          ...layer.transform,
          xMm: pinNewX - ax * layer.widthMm,
          yMm: pinNewY - ay * layer.heightMm,
        },
      }
    }
    return next
  })

  if (nextHash != null) {
    return annotateLayerAdapt(migrated, newKnife, nextHash)
  }
  return migrated
}
