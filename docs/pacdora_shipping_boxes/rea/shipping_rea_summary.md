# 运输箱 REA 摘要

> 日期：2026-10-30  
> 目标页：https://www.pacdora.cn/mockups/mailing-and-shipping-box-mockups  
> 原始 JSON：`shipping_rea_summary.json`、`ctree_raw.json`

## 类目树命中

| 字段 | 值 |
|------|-----|
| 中文名 | 运输箱 |
| path | /盒子/运输箱 |
| nameKey | `mailing-shipping-boxes` |
| **mockupNameKey** | **`mailing-and-shipping-box-mockups`** |
| ctree count | **47** |
| 列表 total | **47**（pageSize=100 一页取完） |

## 已验证接口

1. `GET /api/v2/models/ctree?mockup=true`
2. `GET /api/v2/users/experience_user`
3. `GET /api/v2/models?pageSize=100&current=1&mockupNameKey=mailing-and-shipping-box-mockups&type=blank&sort=popular&mockup=true&offset=0`
4. `GET /api/v2/project/knife?id={列表id}&bleed=5&export_type=model`  
   - **id = 列表 id**（样例 `5066` / num `20001001`），不是 `modeCate.id`

## 样例 knife 包

- `modeCate.code` = `Carton`
- 含 `knifeSize` / `size` / `outSize` / `openParams` / `layer.traditional.cuts|folds|faces`
- 刀版图：列表字段 `knife` → CDN PNG

## 结论

分类 slug 与 URL 一致；可按该 `mockupNameKey` 定点采集 47 条至 `exports/pacdora_shipping_boxes/`。
