# Packative 官方 SVG → Lab 规范 2D

日期：2026-11-12  
范围：validated + holdout crashlock；不虚构 3D；不注入 templates。

## 交付

| 项 | 路径 |
|---|---|
| 静态官方 SVG | `public/packative-geom/productbox-crashlock-{L}_{W}_{H}.svg`（10 份） |
| catalog | `docs/packative_lab_catalog/packative_catalog.json` 字段 `geom_rel` |
| 适配器 | `src/packative/packativeGeomKnife.js` → `boxcraft.knife.v3`，`geomMode`/`fromPackativeGeom`，`faces:[]` |
| Lab | `LegacyLab.vue` Packative 走官方 geom 2D，尺寸锁定，导出 `toSvgDieline`，3D 占位 |

## 验收要点

- Lab Packative → 100×80×80：2D 可见蓝裁切 + 红折线（虚线）+ 可选出血/尺寸；尺寸锁定  
- holdout 100×80×90：可进只读对照  
- unvalidated：仍阻断  
- 3D：无 faces，不调用假折叠  
- `manufacturingReady=false`

## 抽查记录（2026-11-12）

- `parsePackativeOfficialSvg` / normalized：Cutting **133**、Creasing **14**（100×80×80）  
- `npm run build` 通过；`public/packative-geom` 10 份随 dist 发布  
- Lab `/lab`：100×80×80 规范 2D + 尺寸锁定 + 无 3D；holdout 100×80×90 可读；unvalidated 不进入工位

## 回归

- `npm run verify:packative-geom`（catalog / 文件 / 解析门禁）  
- 夯实记录：[`packative-2d-harden.md`](./packative-2d-harden.md)

## 明确不做

- 参数拓扑补全到 63/14  
- Collada/猜测面片假 3D  
- 静默拉伸官方 SVG  
- 扩其它盒型 / 旁路真网大批入库  
