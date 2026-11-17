# 方形盒 REA 摘要

> 日期：2026-11-14  
> 目标页：https://www.pacdora.cn/mockups/square-box-mockup  
> 原始 JSON：square_rea_summary.json、ctree_raw.json

## 类目树命中

| 字段 | 值 |
|------|-----|
| 中文名 | 方形盒 |
| path | /盒子/方形盒 |
| nameKey | square-boxes |
| **mockupNameKey** | **square-box-mockup** |
| ctree count（.cn） | **47** |
| 列表 total（.com） | **112** |

## 已验证接口

1. GET /api/v2/models/ctree?mockup=true
2. GET /api/v2/users/experience_user
3. GET /api/v2/models?...&mockupNameKey=square-box-mockup
4. GET /api/v2/project/knife?id={列表id}&bleed=5&export_type=model  
   - **id = 列表 id**（样例 5066 / num 20001001）  
   - **站点**：.com 成功

## 刀版探针

- knifeSize：305 × 305 × 305
- traditional：cuts=54 / folds=12

## 结论

分类 slug 与 URL 一致；定点采集使用 mockupNameKey=square-box-mockup + pi_origin=https://www.pacdora.com。
