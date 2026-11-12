# Packative sleeve → Lab 规范 2D（探测结论）

日期：2026-11-13  
范围：第四盒型官方 SVG 匿名 CDN 探测；不接 3D；不抬升 `manufacturingReady`。  
状态：**blocked**（全部 403；未入库、未改 catalog / public）

说明：历史 Studio 入口对 sleeve 为 Partial；本轮仅依赖匿名 CDN `dieline.svg`，与 editor 是否曾进无关。

## CDN 探测

租户：`ee4e06e4-c9b7-410f-b600-175fb1212729`  
形态：`…/dielines/sleeve/{L}_{W}_{H}/dieline.svg`  
PDP（未使用，仅备查）：`https://packative.com/products/sleeve/prod_01K1YV37GQ1R0JXDYHDKD4FMM9`

| L×W×H | 结果 | 备注 |
|---|---|---|
| 100×80×50 | 403 | EPS/矩阵锚点；跳过 |
| 200×150×100 | 403 | EPS/矩阵锚点；跳过 |
| 150×100×50 | 403 | 跳过 |
| 120×80×40 | 403 | 跳过 |
| 100×100×50 | 403 | 跳过 |
| 80×60×40 | 403 | 跳过 |
| 200×150×50 | 403 | 跳过 |
| 160×100×40 | 403 | 跳过 |
| 90×70×30 | 403 | 跳过 |
| 110×80×40 | 403 | 跳过 |
| 100×65×20 | 403 | 跳过 |
| 180×120×50 | 403 | 跳过 |

**OK_COUNT = 0**。无 evidence 落盘（无 `studio-dieline-sleeve-*.svg`）。

## Catalog / public

按门禁：**不**增 `template_id: sleeve`；**不**发布 `public/packative-geom/sleeve-*.svg`；**不**编造假 geom。

## 回归

- `npm run verify:packative-geom`：绿（现网 13 SVG：crashlock 10 + mailer 2 + pillow 1）
- crashlock 试点 133/14 未破

## 解锁条件

匿名 CDN 至少 1 个尺寸返回 200 且含 Cutting/Creasing → 再走 catalog + publish + Lab 接线。
