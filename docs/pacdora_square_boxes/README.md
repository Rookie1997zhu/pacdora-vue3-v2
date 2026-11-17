# Pacdora 方形盒定点采集

> 日期：2026-11-14  
> 目标页：https://www.pacdora.cn/mockups/square-box-mockup（列表）/ 几何采集走 **https://www.pacdora.com**  
> REA 摘要：[`rea/square_rea_summary.md`](./rea/square_rea_summary.md)  
> 刀版审计：[`rea/square_dieline_audit.json`](./rea/square_dieline_audit.json)

## 类目

| 项 | 值 |
|----|-----|
| 中文名 | 方形盒 |
| mockupNameKey | `square-box-mockup` |
| ctree count（.cn） | **47** |
| 列表 total（.com 采集） | **112**（历史） |
| 刀版清理后落盘 | **56** 几何 JSON + **56** 刀版图 |
| 清除 | **56**（详情无「下载刀版」或 `.cn` 404；含塑料/GLB 样机等） |
| Lab 目录 | `npm run catalog:build` 后 **方形盒 56**（与清理后 CSV 一致，无尺寸跳过） |

### 无刀版清理规则（2026-11-14）

对每条 CSV 打开 `https://www.pacdora.cn/mockup-detail/{mockupNameKey}`：

- **保留**：页面存在 `.mockup-edit-download`（「下载刀版(AI, PDF)」）
- **清除**：无该按钮，或详情 404

不以 API `knife` 字段单独判定（例：`10263002` API 无 knife 图但仍可下载刀版 → 保留）。

### 站点注意

刀版接口沿用 `.com` + `experience_user`（无需浏览器登录）。`.cn` ctree 标 47，`.com` 列表曾为 112；清理后以审计保留集为准。

### Lab 同步

```bash
npm run catalog:build
# → public/square-covers、public/square-geom、public/square-assets-manifest.json
```

定位：只读尺寸目录 + 锁定样机几何回放；**不**把 Pacdora cuts/folds 当事生产刀版。

## 目录结构

```text
pacdora_square_boxes/
  README.md
  square_boxes.csv|.xlsx
  geometry/{num}.json
  images/full/{num}.png|.svg
  rea/
    square_rea_summary.md
    square_rea_summary.json
    square_dieline_audit.json
    ctree_raw.json
```

## 重跑命令

```bash
cd "C:\Users\ROG STRIX\Desktop\信息搜集\webspider\data search\data_search"
scrapy crawl pacdora_boxes_geom ^
  -a mockup_name_key=square-box-mockup ^
  -a export_dir=pacdora_square_boxes
```

然后将 `exports/pacdora_square_boxes/` 同步到本目录，并重新跑刀版审计清理。

## 接口约定

- 先 `GET /api/v2/users/experience_user`
- 列表：`mockupNameKey=square-box-mockup`
- 刀版：`knife?id={列表id}`
