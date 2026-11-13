# Phase 4 — mailer-parametric-demo 可信刀版（仅软件侧）

日期：2026-11-13  
范围：翻盖邮寄盒 engineering 域 + 回归/导出验收；**无实物打样**；**不宣称** production。  
说明：seed 已有 `canExportManufacturing`（历史 P7.2）**不等于**本阶段工程域合格或实物验证；补偿（panelAdd/outerAdd）仍为示意、未校准。

## 工程域

| 项 | 值 |
|---|---|
| templateId | `mailer-parametric-demo` |
| dimensionBasis | `inner` |
| L×W×H mm | `[200,450]×[120,300]×[40,120]` |
| thickness mm | `[1.0, 2.5]`（seed 默认 1.5） |
| material / flute | `kraft` / `L` |
| 锚点 | `315×202×62@1.5`、`300×200×50@1.5`、`250×150×40@1.2` |
| status | `engineering_review` |

域文件（同构）：

- `packages/geometry-schema/domains/mailer-parametric-demo-engineering-domain.json`
- `backend/apps/exports/data/domains/mailer-parametric-demo-engineering-domain.json`
- `research/packative-dieline-lab/config/mailer-parametric-demo-engineering-domain.json`

## 测试

| 项 | 状态 |
|---|---|
| `npm run check:mailer-parametric-engineering` | **Passed**（三锚点无 approx、hash、engineering SVG；越域拒绝） |
| `npm run check:fefco0201-engineering` | **Passed**（回归保留） |
| `npm run check:tuck-end-straight-engineering` | **Passed**（回归保留） |
| `manage.py test tests.test_exports` | **Passed**（Ran 17 — OK；mailer engineering 成功；无域改用 `fefco-0427`） |
| Compose smoke | **Passed** |
| geometry 容器 mailer engineering SVG | **Passed**（物理 mm + CANDIDATE + `g1:` + mfg=false） |
| 实物打样 | **Not Run** |

## 验收要点

- 域内 engineering 导出成功，`manufacturing_ready=false`，disclaimer 仍为 ENGINEERING CANDIDATE。
- 无域模板（如 `fefco-0427`）仍 DOMAIN 拒绝。
- 不改 manufacturing 审批语义为「已合格」；补偿未实物校准。

## 明确不做

Crashlock、打样 / SampleTestRecord、扩大或关闭 seed manufacturing 审批范围。
