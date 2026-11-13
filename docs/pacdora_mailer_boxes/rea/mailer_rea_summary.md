# 邮寄盒 REA 摘要

> 日期：2026-11-13  
> 目标页：https://www.pacdora.cn/mockups/mailer-box-mockup  
> 原始 JSON：`mailer_rea_summary.json`、`ctree_raw.json`

## 类目树命中

| 字段 | 值 |
|------|-----|
| 中文名 | 邮寄盒 |
| path | /盒子/邮寄盒 |
| nameKey | `mailer-box` |
| **mockupNameKey** | **`mailer-box-mockup`** |
| ctree count（.cn） | **65** |
| 列表 total（.com 采集） | **79** |

## 已验证接口

1. `GET /api/v2/models/ctree?mockup=true`
2. `GET /api/v2/users/experience_user`
3. `GET /api/v2/models?...&mockupNameKey=mailer-box-mockup`
4. `GET /api/v2/project/knife?id={列表id}&bleed=5&export_type=model`  
   - **id = 列表 id**（样例 `1` / num `150010`），不是 `modeCate.id`  
   - **站点**：`.com` 成功；`.cn` 对访客 token 返回 `LOGIN_REQUIRED`

## 采集结果

- `ok=79` / `skip_no_geom=0` / `skip_no_img=0` / `svg_fallback=1`
- 落盘：`docs/pacdora_mailer_boxes/`

## 结论

分类 slug 与 URL 一致；定点采集使用 `mockupNameKey=mailer-box-mockup` + `api_origin=https://www.pacdora.com`。
