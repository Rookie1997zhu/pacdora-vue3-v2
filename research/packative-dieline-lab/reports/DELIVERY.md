# 材料厚度 / 刀缝钩子（首片）交付

## 状态

Research **sensitivity hook** 已落地；**不是**已标定纸厚规律；**不是**可投产。

## 实现

| 项 | 状态 |
|---|---|
| `CrashlockParams.thicknessMm` / `kerfMm`（默认 0） | done |
| `applyMaterialHooks`（bodyExtraH / tipAdd+bigAdd） | done |
| `t=k=0` 几何恒等 | **passed**（`material_hooks_identity_at_zero`） |
| `thickness-sensitivity` 报告 | done |
| 既有 holdout 门禁 | 不变（仍绿） |
| `holdout_full_crashlock_topology` | **blocked**（不变） |

## 钩子语义

- `thicknessMm` → `bodyExtraHMm += t`（与经验 0.5 mm **竞争解释**，不替换）
- `kerfMm` → `tipAddMm` / `bigAddMm` 各 `+= k/2`
- 顶翼 tuck / fillet：**未**接线

## 明确未做

- 从样本拟合 caliper/kerf 系数
- 生产路径 / 投产宣称
- 改 envelope fit

## 产物

- `src/geometry/lockBottomFeatures.ts` → `applyMaterialHooks`
- `reports/thickness-sensitivity.json` / `.md`
