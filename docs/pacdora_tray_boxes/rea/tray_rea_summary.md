# 托盘盒 REA 摘要

> 日期：2026-11-17  
> 目标页：https://www.pacdora.cn/dielines/tray-box-dielines  
> 原始 JSON：tray_rea_summary.json、ctree_raw.json

## 类目树命中

| 字段 | 值 |
|------|-----|
| 中文名 | 托盘盒 |
| path | By Models / 托盘盒 |
| ctree id | **183** |
| nameKey | `tray-boxes` |
| **dielineNameKey** | **`tray-box-dielines`** |
| mockupNameKey | `tray-box-mockups` |
| ctree count（.cn） | **96** |

## 已验证接口

1. `GET /api/v2/models/ctree`（By Models 子节点 id=183）
2. `GET /api/v2/users/experience_user`
3. `GET /api/v2/models?pageSize=60&current=N&dielineNameKey=tray-box-dielines`  
   - 分页参数为 **`current`**，不是 `page`
4. `GET /api/v2/project/knife?id={列表id}&bleed=5&export_type=model`  
   - **id = 列表 id**（样例 `3872` / num `128024`）  
   - **站点**：`www.pacdora.com` 成功

## 刀版探针（样例 128024）

- knifeSize：200.6 × 110.6 × 50.6
- traditional：cuts=155

## 结论

刀版页「模型 → 托盘盒」用 `dielineNameKey=tray-box-dielines` 列表；几何采集走 `.com` + `experience_user` + `knife?id={列表id}`。
