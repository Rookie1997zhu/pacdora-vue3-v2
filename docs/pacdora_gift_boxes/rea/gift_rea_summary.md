# 礼盒 REA 摘要

> 日期：2026-11-14  
> 目标页：https://www.pacdora.cn/mockups/gift-box-mockups  
> 原始 JSON：gift_rea_summary.json、ctree_raw.json

## 类目树命中

| 字段 | 值 |
|------|-----|
| 中文名 | 礼盒 |
| path | /盒子/礼盒 |
| nameKey | gift-boxes |
| **mockupNameKey** | **gift-box-mockups** |
| ctree count（.cn） | **107** |
| 列表 total（.com） | **157** |

## 已验证接口

1. GET /api/v2/models/ctree?mockup=true
2. GET /api/v2/users/experience_user
3. GET /api/v2/models?...&mockupNameKey=gift-box-mockups
4. GET /api/v2/project/knife?id={列表id}&bleed=5&export_type=model  
   - **id = 列表 id**（样例 1500 / num 361011），不是 modeCate.id  
   - **站点**：.com 成功（沿用邮寄盒约定）

## 刀版探针

- modeCate.code：BoutiqueBoxFlipCoveredMain
- knifeSize：L184 × W104 × H42.15
- 多层硬盒：无单一 	raditional 时取 cuts 最密层；样例 FlipCoveredInnerboxFacepaperOutside cuts=68 / folds=29

## 结论

分类 slug 与 URL 一致；定点采集使用 mockupNameKey=gift-box-mockups + pi_origin=https://www.pacdora.com。
