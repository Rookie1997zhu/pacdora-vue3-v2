# Packative Lab 目录草案（P1）

对齐 Pacdora `docs/pacdora_shipping_boxes` 精神：参数/规格目录，**不是**固定资产原件库。

- 现行方案：V1.2 Packative → Lab
- 首盒型：`productbox-crashlock`
- 观察：`research/packative-dieline-lab/reports/p1-rea-ko-session.md`（韩语站）
- 盘点：`research/packative-dieline-lab/reports/p1-sample-inventory.*`

## 文件

| 文件 | 说明 |
|---|---|
| `packative_catalog.json` | 机器可读目录 |
| `packative_catalog.csv` | 同构表格 |

## 字段

template_id / title_zh / title_ko / L_mm / W_mm / H_mm / dimension_basis(=inner) / validation_status / rule_or_geom_version / evidence_ref / default_flag

## 接线状态（P2）

Lab 第三源已读取本目录（[`src/packative/`](../../src/packative/) + `LegacyLab` Packative 页签）。  
改尺寸仅 `validated` AABB；`holdout` 只读对照；`unvalidated` 禁止进入；不写入 `knife.js`。

## 下一步（P3）

按 V1.2 `03` 验收 Lab Packative；holdout/gates 对比报告；可选扩盒型。
