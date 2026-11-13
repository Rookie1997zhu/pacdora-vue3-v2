# Phase 7 — productbox-crashlock 深化（厚度钩子 + 61/14）

日期：2026-11-13  
范围：启用未校准 thickness/kerf 钩子透传；固化结构计数回归；**不**宣称 raw 63、production 或打样。

## 变更

- [`src/crashlock/createCrashlockKnife.js`](../../../src/crashlock/createCrashlockKnife.js)：透传 `thicknessMm` / `params.kerfMm`；validation 含 `structural-count`（61/14）与 `thickness-hooks`
- [`src/knife.js`](../../../src/knife.js)：早退向工厂传入 `params`
- 工程域 `compensationNote`：钩子已启用但 unvalidated；结构 61/14

## 结构计数

| 维度 | 值 |
|---|---|
| Structural Cutting | **61** |
| Structural Creasing | **14** |
| Raw Cutting（含 Class A 零长度伪影） | 63 |
| `holdout_full_crashlock_topology` | **blocked（有意）** — 不发射假 stub |

## 测试

| 项 | 状态 |
|---|---|
| `npm run check:productbox-crashlock-engineering` | **Passed**（61/14、T=0 恒等、T>0 位移、engineering SVG） |
| FEFCO / tuck / mailer check | **Passed**（回归） |
| geometry 容器 crashlock engineering | **Passed**（mfg=false、CANDIDATE、`g1:`） |
| manufacturingReady | **false** |
| 钩子校准 / 打样 | **Not claimed / Not Run** |

## 明确不做

造假 63、dust/fillet/glue 新钩子大扩、`canExportManufacturing`、伪造 SAMPLE pass。
