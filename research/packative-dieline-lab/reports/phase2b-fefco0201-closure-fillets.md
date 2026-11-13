# Phase 2b — FEFCO 0201 合盖补偿/缝宽 + 自由角圆角

日期：2026-11-13  
范围：仅 `fefco-0201`；**无实物打样**；**不宣称** `qualified` / production die。

## 动机

肉眼可见：双外摇盖对缝发紧（合得勉强）；摇盖/接舌直角无圆角。  
保持 RSC 双摇盖对接（不改单盖）。

## 公式（经验默认，未打样）

| 量 | 规则 |
|----|------|
| `slot` | `max(2, T)`（原 `max(3, 2T)`） |
| `meetGap` | `max(1, 0.5·T)` |
| `flapH` | `inner.W/2 − meetGap/2`（原 `panel.W/2`） |
| 圆角 `r` | 目标约 5–8mm：`min(8, max(6, 2.5·T))`，再受短边 `0.2·edge` 约束；仅自由角；铰链边满跨度直线（已加大便于肉眼辨认） |
| `sizeRule` | 仍 `panelAdd {1,1,2}` / `outerAdd {2,2,4}`（示意） |

恒等式：`2·flapH + meetGap = inner.W`（容差 ≤0.5mm）。

实现：[`src/templates/fefco0201.js`](../../../src/templates/fefco0201.js)  
导出：`fefco0201ClosureDims` / `fefco0201FilletRadius` / `fefco0201FilletedOutline`

## 锚点对比（示例 300×200×150@T=3）

| 项 | 改前 | 改后 |
|----|------|------|
| slot | 6 | 3 |
| flapH | ≈101.5（panel.W/2） | 99.25 |
| 对缝 | 顶死风险 | meetGap 1.5mm |
| 摇盖角 | 直角 | 自由角圆角 outline |

## 测试

| 项 | 状态 |
|----|------|
| `npm run check:fefco0201-engineering` | **Passed**（含 slot / flapH+meetGap / outline / mfg=false） |
| 实物打样 / CAD 独立回读 | **Not Run** |
| `manufacturingReady` | **false** |
| `qualificationStatus` | `engineering_review` |

## 明确未做

- 其它盒型（插舌/邮寄/crashlock）未改  
- SampleTestRecord pass、`canExportManufacturing`、完整 chord-error 曲线引擎  

下一步仍是：软件合盖观感确认 → 再考虑线下打样，不得伪造 pass。
