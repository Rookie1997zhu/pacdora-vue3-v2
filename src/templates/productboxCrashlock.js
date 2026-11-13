// Packative Lab Crashlock 参数化刀版描述符。
// 实际几何由 src/crashlock/createCrashlockKnife.js 经 createKnife 早退生成（geomMode 2D）。
// layout 不应被调用；完整 63/14 与 manufacturingReady 均未宣称。

export default {
  id: 'productbox-crashlock',
  label: '锁底盒',
  labelEn: 'Crashlock / Auto-bottom',
  standard: 'Packative Lab parametric',
  root: null,
  faceOrder: Object.freeze([]),
  supportsClosedCheck: false,
  defaults: { length: 100, width: 80, height: 80, thickness: 0.6 },
  // Template limits >= engineering domain AABB so DOMAIN fails before OUT_OF_RANGE.
  limits: { length: [55, 200], width: [55, 150], height: [60, 100] },
  sizeRule: {
    panelAdd: { length: 0, width: 0, height: 0 },
    outerAdd: { length: 0, width: 0, height: 0 },
  },
  layout() {
    throw new Error('productbox-crashlock uses createCrashlockKnife geomMode path; layout is unused')
  },
}
