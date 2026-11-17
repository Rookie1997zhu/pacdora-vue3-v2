# 折叠盒 REA 摘要

> 日期：2026-11-17  
> 目标页：https://www.pacdora.cn/dielines/folding-box-dielines  
> 原始 JSON：folding_rea_summary.json、ctree_raw.json

## 类目树命中

| 字段 | 值 |
|------|-----|
| 中文名 | 折叠盒 |
| path | By Models / 折叠盒 |
| ctree id | **175** |
| nameKey | `folding-boxes` |
| **dielineNameKey** | **`folding-box-dielines`** |
| mockupNameKey | `folding-box-mockups` |
| ctree count（.cn） | **261** |

## 已验证接口

1. `GET /api/v2/models/ctree`（By Models 子节点 id=175）
2. `GET /api/v2/users/experience_user`
3. `GET /api/v2/models?pageSize=60&current=N&dielineNameKey=folding-box-dielines`  
   - 分页参数为 **`current`**，不是 `page`
4. `GET /api/v2/project/knife?id={列表id}&bleed=5&export_type=model`  
   - **id = 列表 id**（样例 `1` / num `150010`）  
   - **站点**：`www.pacdora.com` 成功

## 刀版探针（样例 150010）

- knifeSize：315 × 202 × 62
- traditional：cuts=89 / folds=22

## 结论

刀版页「模型 → 折叠盒」用 `dielineNameKey=folding-box-dielines` 列表；几何采集走 `.com` + `experience_user` + `knife?id={列表id}`。
