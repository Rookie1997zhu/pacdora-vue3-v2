# Phase 3 — tuck-end-straight 可信刀版（仅软件侧）

日期：2026-11-13  
范围：多模板 engineering 域注册表 + 直插舌盒工程域/回归；**无实物打样**；**不宣称** production。

## 域注册表

- Node：`packages/geometry-schema/domains/<templateId>-engineering-domain.json`
- Django：`backend/apps/exports/data/domains/`
- API：`loadEngineeringDomain(templateId)` / `check_engineering_domain(payload)`

已注册：`fefco-0201`、`tuck-end-straight`。无域模板 → DOMAIN 拒绝。

## tuck-end-straight 工程域

| 项 | 值 |
|---|---|
| L×W×H mm | `[50,200]×[30,120]×[80,300]` |
| thickness mm | `[0.3, 1.2]`（seed 默认 0.5） |
| material / flute | `kraft` / `L` |
| 锚点 | `80×50×150@0.5`、`60×40×100@0.4`、`120×80×200@0.8` |
| status | `engineering_review` |

## 测试

| 项 | 状态 |
|---|---|
| `npm run check:fefco0201-engineering` | **Passed** |
| `npm run check:tuck-end-straight-engineering` | **Passed** |
| `manage.py test tests.test_exports` | **Passed**（Ran 16 — OK，含 tuck engineering） |
| Compose smoke | **Passed** |
| geometry 容器 tuck engineering SVG | **Passed**（物理 mm + CANDIDATE + `g1:` + mfg=false） |
| 实物打样 | **Not Run** |

## 明确不做

反插舌 / 开窗、打样工作流、manufacturing capability、邮寄盒 / Crashlock。
