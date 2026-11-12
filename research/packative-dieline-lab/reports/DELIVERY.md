# 精确 cubic 圆角交付

## 范围

- 仅 research lab `productbox-crashlock`
- 外框第三刀 + 8 条 Cutting path 参数化精确 cubic
- **不是**完整 63/14 精确复刻，**不是**可投产

## 实现

| 项 | 状态 |
|---|---|
| `parsePathD` / normalize 保留 `c0/c1` | done |
| `bodyOutlineFeatures` 精确 cubic | done |
| SVG `<path d="M…C…">` 渲染 | done |
| outline 端点门禁 + cubic 残差门禁 | done |
| `body_outline_cutting_correspondence` | **passed**（endpoint + curve_exact） |
| lock / top 门禁 | **passed**（保留；仍 curve_approx） |
| `holdout_full_crashlock_topology` | **blocked**（`degenerate_segments_remain`） |

## Holdout

- 冻结：`100×80×90`
- 外框：matched ≥8/~11，medianNorm≤0.06，medianCubicNorm≤0.06
- 见 `body-outline-match.md`

## 明确未做

- 零长度退化段
- 材料厚度
- 完整 63 计数硬门禁 / 投产宣称

## 产物

- `proto-crashlock-*-outline.svg`（含 cubic path）
- `reports/body-outline-match.json` / `.md`
