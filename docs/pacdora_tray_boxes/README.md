# Pacdora 托盘盒定点采集

> 日期：2026-11-17  
> 目标页：https://www.pacdora.cn/dielines/tray-box-dielines  
> 几何采集走 **https://www.pacdora.com**  
> REA 摘要：[`rea/tray_rea_summary.md`](./rea/tray_rea_summary.md)

## 类目

| 项 | 值 |
|----|-----|
| 中文名 | 托盘盒 |
| **dielineNameKey** | **`tray-box-dielines`** |
| ctree count（.cn） | **96** |
| 列表 total（.com 采集） | **125** |
| 几何 / 刀版图 | 与 CSV 一一对应 |

### Lab / 定制同步

```bash
npm run catalog:build
# → public/tray-covers、public/tray-geom、public/tray-assets-manifest.json
```

## 重跑命令

```bash
cd "C:\Users\ROG STRIX\Desktop\信息搜集\webspider\data search\data_search"
scrapy crawl pacdora_boxes_geom ^
  -a dieline_name_key=tray-box-dielines ^
  -a export_dir=pacdora_tray_boxes
```

然后将 `exports/pacdora_tray_boxes/` 同步到本目录。

## 接口约定

- 先 `GET /api/v2/users/experience_user`
- 列表：`dielineNameKey=tray-box-dielines`（分页 `current`）
- 刀版：`knife?id={列表id}`
