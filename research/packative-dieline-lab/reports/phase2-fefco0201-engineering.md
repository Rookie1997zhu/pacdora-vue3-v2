# Phase 2 — FEFCO 0201 可信刀版（仅软件侧）

日期：2026-11-13  
范围：engineering 导出档 + 工程域 + 回归；**无实物打样**；**不宣称** `qualified` / production die。

## 工程域

配置：`packages/geometry-schema/fefco-0201-engineering-domain.json`（研究副本与 backend `exports/data/` 同步）

| 项 | 值 |
|---|---|
| templateId | `fefco-0201` |
| dimensionBasis | `inner` |
| L×W×H mm | `[200,400]×[150,300]×[100,250]` |
| thickness mm | `[2.0, 4.0]` |
| material / flute | `kraft` / `L` |
| status | `engineering_review` |
| 锚点 | `300×200×150@3`、`200×150×100@2`、`400×300×250@4` |

补偿：`sizeRule` 仍为示意，未校准。  
合盖/圆角后续见 [`phase2b-fefco0201-closure-fillets.md`](phase2b-fefco0201-closure-fillets.md)（`slot=max(2,T)`、`flapH` 按 inner.W、自由角圆角；仍未打样）。

## 导出档

| quality_tier | 用途 |
|---|---|
| `vector_proof` | 校样 |
| **`engineering`** | 可信刀版：物理 mm SVG；gate = GEOMETRY+UNIT+APPROX+DOMAIN；`manufacturing_ready=false` |
| `manufacturing` | 生产（FEFCO 仍无 capability） |

Disclaimer：`ENGINEERING CANDIDATE · COMPENSATION UNVERIFIED · NOT FOR PRODUCTION DIE`

## 测试

| 项 | 状态 |
|---|---|
| `npm run check:fefco0201-engineering` | **Passed** |
| `manage.py test tests.test_exports` | **Passed**（Ran 15 — OK，含 engineering 成功/域外/几何失败） |
| Compose smoke（重建后） | **Passed** |
| geometry 容器 FEFCO engineering SVG | **Passed**（物理 mm + ENGINEERING CANDIDATE + `g1:` hash） |
| 实物打样 / CAD 独立回读 | **Not Run** |

## 下一步（未做）

打样工作流 + 限定 materials/设备实测后，才可为 FEFCO 开 `canExportManufacturing` / `qualified`。
