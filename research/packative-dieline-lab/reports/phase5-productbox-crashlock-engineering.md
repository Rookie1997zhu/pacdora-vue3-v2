# Phase 5 — productbox-crashlock 可信刀版（仅软件侧）

日期：2026-11-13  
范围：Lab Crashlock 原型收成 `createKnife` 参数化刀版 + engineering 域/回归；**无实物打样**；**不宣称**完整 63/14 或 production。

## 架构

- 引擎包：`packages/crashlock-engine/index.mjs`（`npm run build:crashlock-engine` 自 Lab TS 打包）
- 刀版工厂：`src/crashlock/createCrashlockKnife.js`（uu→mm、Y 翻转、geomMode 2D）
- `createKnife` 对 `productbox-crashlock` 早退；模板描述符 `src/templates/productboxCrashlock.js`
- 厚度/kerf：几何恒等（`thicknessMm=0`），seed 默认厚度 0.6 仅作域内元数据

## 工程域

| 项 | 值 |
|---|---|
| templateId | `productbox-crashlock` |
| dimensionBasis | `inner` |
| L×W×H mm | `[55,200]×[55,150]×[60,100]`（Lab catalog AABB） |
| thickness mm | `[0.3, 1.2]`（seed 默认 0.6） |
| material / flute | `kraft` / `L` |
| 锚点 | `100×80×80@0.6`、`55×55×75@0.6`、`100×80×90@0.6`（holdout） |
| status | `engineering_review` |

## 测试

| 项 | 状态 |
|---|---|
| `npm run check:productbox-crashlock-engineering` | **Passed** |
| `npm run check:fefco0201-engineering` | **Passed**（回归保留） |
| `npm run check:tuck-end-straight-engineering` | **Passed**（回归保留） |
| `npm run check:mailer-parametric-engineering` | **Passed**（回归保留） |
| `manage.py test tests.test_exports` | **Passed**（Ran 18 — OK，含 crashlock engineering） |
| Compose smoke | **Passed** |
| geometry 容器 crashlock engineering SVG | **Passed**（物理 mm + CANDIDATE + `g1:` + mfg=false） |
| 实物打样 | **Not Run** |
| holdout_full_crashlock_topology | **Not claimed**（仍 blocked） |

## 明确不做

打样 / SampleTestRecord、`canExportManufacturing`、完整 63/14、用 `auto-lock-bottom` 冒充 Crashlock。
