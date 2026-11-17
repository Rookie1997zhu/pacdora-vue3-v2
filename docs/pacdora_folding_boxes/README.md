# Pacdora 折叠盒定点采集

> 日期：2026-11-17  
> 目标页：https://www.pacdora.cn/dielines/folding-box-dielines  
> 几何采集走 **https://www.pacdora.com**  
> REA 摘要：[`rea/folding_rea_summary.md`](./rea/folding_rea_summary.md)

## 类目

| 项 | 值 |
|----|-----|
| 中文名 | 折叠盒 |
| **dielineNameKey** | **`folding-box-dielines`** |
| ctree count（.cn） | **261** |
| 列表 total（.com 采集） | **507** |
| 几何 / 刀版图 | 与 CSV 一一对应 |

### 站点注意

列表可用 `.cn`；刀版接口沿用 `.com` + `experience_user`。`.com` 同 key 条数可能多于 `.cn`。

### Lab / 定制同步

```bash
npm run catalog:build
# → public/folding-covers、public/folding-geom、public/folding-assets-manifest.json
```

## 重跑命令

```bash
cd "C:\Users\ROG STRIX\Desktop\信息搜集\webspider\data search\data_search"
scrapy crawl pacdora_boxes_geom ^
  -a dieline_name_key=folding-box-dielines ^
  -a export_dir=pacdora_folding_boxes
```

然后将 `exports/pacdora_folding_boxes/` 同步到本目录。

## 接口约定

- 先 `GET /api/v2/users/experience_user`
- 列表：`dielineNameKey=folding-box-dielines`（分页 `current`）
- 刀版：`knife?id={列表id}`
