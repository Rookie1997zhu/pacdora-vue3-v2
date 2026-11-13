// FEFCO 0201 开槽纸箱（RSC）：四片墙板一字排开 + 接舌，上下各四片等高摇盖，外摇盖在中线对接。
// 补偿/缝宽/摇盖高度为经验默认（kraft、工程域 T∈[2,4]），未实物打样校准，不得宣称 production die。

const round = (n) => Math.round(n * 1000) / 1000

/** 开槽缝、中线对缝隙、摇盖高度（供 layout 与回归共用） */
export function fefco0201ClosureDims({ innerWidth, T }) {
  const t = Number(T)
  const iw = Number(innerWidth)
  const slot = round(Math.max(2, t))
  const meetGap = round(Math.max(1, 0.5 * t))
  const flapH = round(iw / 2 - meetGap / 2)
  return { slot, meetGap, flapH }
}

/** 摇盖/接舌自由角半径：观感可辨约 5–8mm；短边约束；未打样 */
export function fefco0201FilletRadius({ T, edgeMm }) {
  const t = Number(T)
  const e = Number(edgeMm)
  const target = Math.min(8, Math.max(6, 2.5 * t))
  const capped = Math.min(target, e * 0.2, e / 2 - 0.5)
  return round(Math.max(3, Math.min(8, Math.max(0, capped))))
}

/**
 * 相对 bbox 轮廓：仅圆自由角，铰链边保持满跨度直线。
 * hingeSide: top 子面铰在底边；bottom 子面铰在顶边；glue 在 left 时铰在右边。
 */
export function fefco0201FilletedOutline(w, h, r, hingeSide, arcSeg = 3) {
  const W = round(w)
  const H = round(h)
  let rad = Math.max(0, Math.min(Number(r) || 0, W / 2 - 1e-6, H / 2 - 1e-6))
  if (rad < 0.25) {
    return [
      [0, 0],
      [W, 0],
      [W, H],
      [0, H],
    ]
  }
  rad = round(rad)
  const pts = []
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= arcSeg; i++) {
      const u = a0 + (a1 - a0) * (i / arcSeg)
      pts.push([round(cx + rad * Math.cos(u)), round(cy + rad * Math.sin(u))])
    }
  }
  // y 向下；弧心在角内侧；铰链边端点保留满跨度
  if (hingeSide === 'bottom') {
    // free: top-left, top-right; hinge: (0,H)-(W,H)
    pts.push([rad, 0])
    arc(W - rad, rad, -Math.PI / 2, 0)
    pts.push([W, H])
    pts.push([0, H])
    arc(rad, rad, Math.PI, (Math.PI * 3) / 2)
  } else if (hingeSide === 'top') {
    // free: bottom-left, bottom-right; hinge: (0,0)-(W,0)
    pts.push([0, 0])
    pts.push([W, 0])
    arc(W - rad, H - rad, 0, Math.PI / 2)
    arc(rad, H - rad, Math.PI / 2, Math.PI)
  } else if (hingeSide === 'right') {
    // glue left of parent: hinge on right x=W; free left corners
    pts.push([rad, 0])
    pts.push([W, 0])
    pts.push([W, H])
    arc(rad, H - rad, Math.PI / 2, Math.PI)
    arc(rad, rad, Math.PI, (Math.PI * 3) / 2)
  } else {
    // hinge left: free right corners
    pts.push([0, 0])
    arc(W - rad, rad, -Math.PI / 2, 0)
    arc(W - rad, H - rad, 0, Math.PI / 2)
    pts.push([0, H])
  }
  // Deduplicate consecutive near-equal points
  const out = []
  for (const p of pts) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev[0] - p[0]) < 1e-6 && Math.abs(prev[1] - p[1]) < 1e-6) continue
    out.push(p)
  }
  return out
}

export default {
  id: 'fefco-0201',
  label: '开槽纸箱',
  labelEn: 'Regular Slotted Container',
  standard: 'FEFCO 0201',
  root: 'front',
  faceOrder: Object.freeze([
    'front',
    'right',
    'back',
    'left',
    'glueFlap',
    'frontTop',
    'rightTop',
    'backTop',
    'leftTop',
    'frontBottom',
    'rightBottom',
    'backBottom',
    'leftBottom',
  ]),
  supportsClosedCheck: true,
  defaults: { length: 300, width: 200, height: 150, thickness: 3 },
  limits: { length: [80, 1500], width: [60, 1200], height: [40, 1200] },
  // 经验默认：panel = inner + panelAdd·T；未打样校准
  sizeRule: {
    panelAdd: { length: 1, width: 1, height: 2 },
    outerAdd: { length: 2, width: 2, height: 4 },
  },
  // 长边外摇盖略小于 90°，叠在短边内摇盖外侧
  hingeAngles: { frontTop: 88, backTop: 88, frontBottom: 88, backBottom: 88 },
  closedCheck: {
    pairs: [
      ['frontTop', 'backTop'],
      ['frontBottom', 'backBottom'],
      ['leftTop', 'frontTop'],
      ['rightTop', 'frontTop'],
      ['leftBottom', 'frontBottom'],
      ['rightBottom', 'frontBottom'],
    ],
    buildBoxes({ panel, inner, T }) {
      const Lp = panel.length
      const Wp = panel.width
      const Hp = panel.height
      const iw = inner?.width ?? Wp
      const { meetGap, flapH } = fefco0201ClosureDims({ innerWidth: iw, T })
      const t = T
      const box = (cx, cy, cz, hx, hy, hz) => ({
        min: [cx - hx, cy - hy, cz - hz],
        max: [cx + hx, cy + hy, cz + hz],
      })
      // 外摇盖对中线留 meetGap；半高约 flapH
      const halfFlap = flapH / 2
      const gapHalf = meetGap / 4
      return {
        frontTop: box(0, halfFlap + gapHalf, Hp, Lp / 2 * 0.9, halfFlap * 0.95, t / 2),
        backTop: box(0, -(halfFlap + gapHalf), Hp, Lp / 2 * 0.9, halfFlap * 0.95, t / 2),
        leftTop: box(-Lp / 4, 0, Hp - t, Lp / 4 * 0.9, Wp / 2 * 0.85, t / 2),
        rightTop: box(Lp / 4, 0, Hp - t, Lp / 4 * 0.9, Wp / 2 * 0.85, t / 2),
        frontBottom: box(0, halfFlap + gapHalf, 0, Lp / 2 * 0.9, halfFlap * 0.95, t / 2),
        backBottom: box(0, -(halfFlap + gapHalf), 0, Lp / 2 * 0.9, halfFlap * 0.95, t / 2),
        leftBottom: box(-Lp / 4, 0, t, Lp / 4 * 0.9, Wp / 2 * 0.85, t / 2),
        rightBottom: box(Lp / 4, 0, t, Lp / 4 * 0.9, Wp / 2 * 0.85, t / 2),
      }
    },
  },
  layout({ panel, inner, T }) {
    const Lp = panel.length
    const Wp = panel.width
    const Hp = panel.height
    const iw = inner?.width ?? Wp
    const { slot, meetGap, flapH } = fefco0201ClosureDims({ innerWidth: iw, T })
    const glueW = Math.min(30, Lp * 0.25)
    const glueInset = Math.min(5, Hp * 0.08)
    const x0 = glueW + 20
    const y0 = flapH + 20
    const walls = [
      ['front', Lp],
      ['right', Wp],
      ['back', Lp],
      ['left', Wp],
    ]
    const faces = []
    const pos = {}
    let x = x0
    walls.forEach(([name, w], i) => {
      faces.push([name, x, y0, w, Hp, i ? walls[i - 1][0] : null, i ? 'right' : null])
      pos[name] = { x, w }
      x += w
    })

    const glueH = Hp - 2 * glueInset
    const glueR = fefco0201FilletRadius({ T, edgeMm: Math.min(glueW, glueH) })
    faces.push([
      'glueFlap',
      x0 - glueW,
      y0 + glueInset,
      glueW,
      glueH,
      'front',
      'left',
      { outline: fefco0201FilletedOutline(glueW, glueH, glueR, 'right') },
    ])

    for (const [name] of walls) {
      const { x: px, w } = pos[name]
      const fw = w - slot
      const fx = px + slot / 2
      const r = fefco0201FilletRadius({ T, edgeMm: Math.min(fw, flapH) })
      faces.push([
        `${name}Top`,
        fx,
        y0 - flapH,
        fw,
        flapH,
        name,
        'top',
        { outline: fefco0201FilletedOutline(fw, flapH, r, 'bottom') },
      ])
      faces.push([
        `${name}Bottom`,
        fx,
        y0 + Hp,
        fw,
        flapH,
        name,
        'bottom',
        { outline: fefco0201FilletedOutline(fw, flapH, r, 'top') },
      ])
    }

    const lenY = y0 + Hp * 0.3
    const widY = y0 + Hp * 0.7
    const arrows = {
      length: [
        { x: x0, y: lenY },
        { x: x0 + Lp, y: lenY },
      ],
      width: [
        { x: x0 + Lp, y: widY },
        { x: x0 + Lp + Wp, y: widY },
      ],
      height: [
        { x: x0 + Lp + Wp + Lp / 2, y: y0 },
        { x: x0 + Lp + Wp + Lp / 2, y: y0 + Hp },
      ],
    }
    return {
      faces,
      arrows,
      closure: { slot, meetGap, flapH, innerWidth: iw },
    }
  },
}
