# Packative pillowbox → Lab 规范 2D（首批）

日期：2026-11-13  
范围：第三盒型官方 SVG；不接 3D；不抬升 `manufacturingReady`。  
不在本轮：运输箱产品目录导入（`shipping_catalog_import`，别处推进）。

## CDN 探测

租户：`ee4e06e4-c9b7-410f-b600-175fb1212729`  
形态：`…/dielines/pillowbox/{L}_{W}_{H}/dieline.svg`

| L×W×H | 结果 | 备注 |
|---|---|---|
| 100×65×20 | **200 SVG** | PI016 锚点；入库 |
| 80×60×40 | 403 | 跳过 |
| 100×80×40 | 403 | 跳过 |
| 200×150×100 | 403 | 跳过 |
| 其它抽样 | 多为 403 | 跳过 |

证据：`docs/packative-research/evidence/studio-dieline-pillowbox-100_65_20.svg`

## Catalog / public

| 规格 | status | geom_rel | knife cuts/creases |
|---|---|---|---|
| 100×65×20 | validated | `packative-geom/pillowbox-100_65_20.svg` | 84 / 42 |

仅 1 规格 → **无 holdout**（计划门槛：≥1 可接 Lab）。

## 回归

- `npm run publish:packative-geom`：13 份（crashlock 10 + mailer 2 + pillow 1）
- `npm run verify:packative-geom`：绿；crashlock 试点 133/14 未破

## Lab

- Packative 列表出现 pillowbox；`canEnterPackativeRow` 真；`geom_rel` 齐
- AABB 按 `template_id` 隔离（既有）
- 仍 `faces:[]` / 无 3D
