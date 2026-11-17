# Pacdora 礼盒定点采集

> 日期：2026-11-14  
> 目标页：https://www.pacdora.cn/mockups/gift-box-mockups（列表）/ 几何采集走 **https://www.pacdora.com**（见下）  
> REA 摘要：[`rea/gift_rea_summary.md`](./rea/gift_rea_summary.md)

## 类目

| 项 | 值 |
|----|-----|
| 中文名 | 礼盒 |
| mockupNameKey | `gift-box-mockups` |
| ctree count（.cn） | **107** |
| 列表 total（.com 采集） | **157** |
| 本次落盘 | **157** 几何 JSON + **157** 刀版图（`skip_no_geom=0` / `skip_no_img=0`；`svg_fallback=5`） |
| Lab 目录 | `npm run catalog:build` 后 **礼盒 145**（落盘 157；**12** 条 L/W/H 全 0 或不可用，尺寸目录跳过） |

### 站点注意

2026-11 实测：刀版接口沿用邮寄盒约定，以 **www.pacdora.com** 采集为准（`.cn` 对访客易 `LOGIN_REQUIRED`）。硬盒常为多层 `layer`；爬虫取 cuts 最密层写入几何统计。

### Lab 同步

```bash
npm run catalog:build
# → src/catalog/presets.js（shipping+mailer+gift）
# → public/gift-covers、public/gift-geom、public/gift-assets-manifest.json
```

定位：只读尺寸目录 + 锁定样机几何回放；**不**把 Pacdora cuts/folds 当事生产刀版。

## 目录结构

```text
pacdora_gift_boxes/
  README.md
  gift_boxes.csv|.xlsx
  geometry/{num}.json
  images/full/{num}.png|.svg
  rea/
    gift_rea_summary.md
    gift_rea_summary.json
    ctree_raw.json
```

## 重跑命令

```bash
cd "C:\Users\ROG STRIX\Desktop\信息搜集\webspider\data search\data_search"
scrapy crawl pacdora_boxes_geom ^
  -a mockup_name_key=gift-box-mockups ^
  -a export_dir=pacdora_gift_boxes
```

然后将 `exports/pacdora_gift_boxes/` 同步到本目录。

## CSV 主要字段

列表 id、模型编号、名称、mockupNameKey、分类、刀版/内外尺寸、材质、切割/折线段数、展开宽高、`几何文件`、`刀版图文件`、详情链接。

## 接口约定

- 先 `GET /api/v2/users/experience_user`
- 列表：`mockupNameKey=gift-box-mockups`
- 刀版：`knife?id={列表id}`（**不是** `modeCate.id` / `num`）
- 坐标仅作离线反推；不作为 BOXCRAFT 运行时生产刀版库
