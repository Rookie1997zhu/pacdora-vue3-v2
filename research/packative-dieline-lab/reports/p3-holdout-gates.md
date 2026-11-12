# P3 — Holdout / gates 对比报告

日期：2026-11-12（包络对齐复验同日）  
范围：Lab Packative crashlock 原型回放 vs 研究台 `validation-results.json`  
机器摘要：[`p3-holdout-gates.json`](./p3-holdout-gates.json)（由 `node scripts/p3-holdout-compare.mjs` 生成）

## 结论（先读）

- 研究台 **结构 gates（除 full topology）均为 passed**；`holdout_full_crashlock_topology` 仍为 **blocked**（raw 63 含不发射的零长度导出伪影）。
- Lab 回放对 baseline / cross-scale / holdout **均能发出 SVG**（局部原型），**不得**宣称完整 63/14 拓扑或 `manufacturingReady`。
- **包络已对齐**：Lab / 默认 `GEOM_*` 已同步 `fit-coeffs.json`（与 validated-rules OLS 一致）。holdout `|lab−obs|` 宽 ≈0.0014 uu、高 ≈0.0002 uu，与研究台 holdoutEval 同量级（不再是 ~183 uu 宽差）。

## Holdout 冻结

- 尺寸：`100×80×90`（`validated-rules.holdout_frozen`）
- 目录行：`validation_status=holdout`（Lab 只读对照）

## 研究台 gate 摘要

| id | status |
|---|---|
| detect_access_denied_stubs | passed |
| holdout_envelope_width | passed（obsW≈1404.09 uu，err≈0.0014） |
| holdout_envelope_height | passed（obsH≈869.29 uu，err≈0.0002） |
| crease_segment_correspondence | passed |
| lock_bottom_cutting_correspondence | passed |
| top_flap_cutting_correspondence | passed |
| body_outline_cutting_correspondence | passed |
| structural_cutting_count_correspondence | passed（proto structural=61） |
| holdout_full_crashlock_topology | **blocked** |
| synthetic_svg_emits_ev_style | passed |
| material_hooks_identity_at_zero | passed |

## Lab 回放抽样（对齐后）

| 规格 | classify | widthUu（原型） | heightUu（原型） |
|---|---|---:|---:|
| 100×80×80 baseline | validated | ≈1404.09 | ≈831.50 |
| 55×55×75 | validated | ≈874.96 | ≈661.42 |
| 100×80×90 holdout | holdout | ≈1404.09 | ≈869.29 |

### 包络对照（holdout）

| 量 | 研究台 obs | Lab 原型（= research pred） | \|Δ\| vs obs |
|---|---:|---:|---:|
| widthUu | 1404.0896 | 1404.09105 | ≈0.00145 |
| heightUu | 869.2916 | 869.29140 | ≈0.00020 |

## Catalog 真实性（连带）

- 总行 12；validated 9 / holdout 1 / unvalidated 2；`evidence_ref` 覆盖 12/12
- AABB：L 55–200 · W 55–150 · H 60–100
- 旁路真实固定资产库存：**0**（fixtures 不计）

## manufacturingReady

**false**（本任务未升级，亦不得升级）
