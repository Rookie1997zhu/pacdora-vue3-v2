# Packative mailerbox → Lab 规范 2D（首批）

日期：2026-11-12  
范围：第二盒型官方 SVG；不接 3D；不抬升 `manufacturingReady`。

## CDN 探测

租户：`ee4e06e4-c9b7-410f-b600-175fb1212729`  
形态：`…/dielines/mailerbox/{L}_{W}_{H}/dieline.svg`

| L×W×H | 结果 | 备注 |
|---|---|---|
| 160×160×70 | **200 SVG** | 入库；Cutting/Creasing 可解析 |
| 100×100×50 | **200 SVG** | 入库（额外探测命中缓存） |
| 100×80×50 | 403 | 跳过，不编造 |
| 200×150×100 | 403 | 跳过 |
| 其它抽样（200×150×50 等） | 多为 403 | 跳过 |

证据：

- `docs/packative-research/evidence/studio-dieline-mailerbox-160_160_70.svg`
- `docs/packative-research/evidence/studio-dieline-mailerbox-100_100_50.svg`

## Catalog / public

| 规格 | status | geom_rel | knife cuts/creases |
|---|---|---|---|
| 160×160×70 | validated | `packative-geom/mailerbox-160_160_70.svg` | 223 / 26 |
| 100×100×50 | validated | `packative-geom/mailerbox-100_100_50.svg` | 227 / 26 |

仅 2 规格 → **无 holdout**（计划：≥3 才留 holdout）。

## 回归

- `npm run publish:packative-geom`：12 份（crashlock 10 + mailer 2）
- `npm run verify:packative-geom`：绿；crashlock 试点 100×80×80 仍为 133/14

## Lab 门禁

- Packative 列表出现 mailerbox 两行；`canEnterPackativeRow` 真；需 `geom_rel`
- `validatedBounds` / `classifySize` **按 template_id 隔离**，避免与 crashlock AABB 合并
- knife 仍 `faces:[]` / `manufacturingReady=false`；`build3D` 无面则无折叠

## 明确不做

- 未缓存尺寸硬拉 / 编造 SVG  
- EngView 3D、第三盒型、真网大批入库  
