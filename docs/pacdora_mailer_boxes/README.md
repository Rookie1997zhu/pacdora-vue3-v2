# Pacdora 邮寄盒定点采集

> 日期：2026-11-13  
> 目标页：https://www.pacdora.cn/mockups/mailer-box-mockup（列表）/ 几何采集走 **https://www.pacdora.com**（见下）  
> REA 摘要：[`rea/mailer_rea_summary.md`](./rea/mailer_rea_summary.md)

## 类目

| 项 | 值 |
|----|-----|
| 中文名 | 邮寄盒 |
| mockupNameKey | `mailer-box-mockup` |
| ctree count（.cn） | **65** |
| 列表 total（.com 采集） | **79** |
| 本次落盘 | **79** 几何 JSON + **79** 刀版图（`skip_no_geom=0` / `skip_no_img=0`；`svg_fallback=1`） |
| Lab 目录 | `npm run catalog:build` 合并后 **邮寄盒 79**（与运输箱同号可跨类目并存） |

### 站点注意

2026-11 实测：`experience_user` 后 `/api/v2/project/knife` 在 **www.pacdora.cn** 返回 `LOGIN_REQUIRED`；在 **www.pacdora.com** 正常。本目录几何以 `.com` 采集为准。

### Lab 同步

```bash
npm run catalog:build
# → src/catalog/presets.js（shipping+mailer）
# → public/mailer-covers、public/mailer-geom、public/mailer-assets-manifest.json
```

定位：只读尺寸目录 + 锁定样机几何回放；**不**把 Pacdora cuts/folds 当事生产刀版。

## 目录结构

```text
pacdora_mailer_boxes/
  README.md
  mailer_boxes.csv|.xlsx
  geometry/{num}.json
  images/full/{num}.png|.svg
  rea/
    mailer_rea_summary.md
    mailer_rea_summary.json
    ctree_raw.json
```

## 重跑命令

```bash
cd "C:\Users\ROG STRIX\Desktop\信息搜集\webspider\data search\data_search"
scrapy crawl pacdora_boxes_geom ^
  -a mockup_name_key=mailer-box-mockup ^
  -a export_dir=pacdora_mailer_boxes
```

然后将 `exports/pacdora_mailer_boxes/` 同步到本目录。

## CSV 主要字段

列表 id、模型编号、名称、mockupNameKey、分类、刀版/内外尺寸、材质、切割/折线段数、展开宽高、`几何文件`、`刀版图文件`、详情链接。

## 接口约定

- 先 `GET /api/v2/users/experience_user`
- 列表：`mockupNameKey=mailer-box-mockup`
- 刀版：`knife?id={列表id}`（**不是** `modeCate.id` / `num`）
- 坐标仅作离线反推；不作为 BOXCRAFT 运行时生产刀版库
