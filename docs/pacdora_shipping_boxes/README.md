# Pacdora 运输箱定点采集

> 日期：2026-10-30  
> 目标页：https://www.pacdora.cn/mockups/mailing-and-shipping-box-mockups  
> REA 摘要：[`rea/shipping_rea_summary.md`](./rea/shipping_rea_summary.md)

## 类目

| 项 | 值 |
|----|-----|
| 中文名 | 运输箱 |
| mockupNameKey | `mailing-and-shipping-box-mockups` |
| ctree / 列表 total | **47** |
| 本次落盘 | **47** 几何 JSON + **47** 刀版图（`skip_no_geom=0` / `skip_no_img=0`） |

## 目录结构

```text
pacdora_shipping_boxes/
  README.md
  shipping_boxes.csv|.xlsx
  geometry/{num}.json
  images/full/{num}.png|.svg
  rea/
    shipping_rea_summary.md
    shipping_rea_summary.json
    ctree_raw.json
```

## 重跑命令

```bash
cd "data search/data_search"
scrapy crawl pacdora_boxes_geom ^
  -a mockup_name_key=mailing-and-shipping-box-mockups ^
  -a export_dir=pacdora_shipping_boxes
```

试跑（本子类仅 1 页即可全量）：

```bash
scrapy crawl pacdora_boxes_geom -a mockup_name_key=mailing-and-shipping-box-mockups -a export_dir=pacdora_shipping_boxes -a max_pages=1
```

## CSV 主要字段

列表 id、模型编号、名称、mockupNameKey、分类、刀版/内外尺寸、材质、切割/折线段数、展开宽高、`几何文件`、`刀版图文件`、详情链接。

## 接口约定

- 先 `GET /api/v2/users/experience_user`
- 列表：`mockupNameKey=mailing-and-shipping-box-mockups`
- 刀版：`knife?id={列表id}`（**不是** `modeCate.id`）
- 坐标仅作离线反推；不作为 BOXCRAFT 运行时模板库
