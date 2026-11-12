# 外框收尾（第三刀）交付

## 范围

- 仅 research lab `productbox-crashlock`
- 右外直边 + 体板水平外切 + 微连接 + 8 条 path 圆角弦近似
- **不是**完整 63/14 精确复刻，**不是**可投产

## 实现

| 项 | 状态 |
|---|---|
| `bodyOutlineFeatures.ts` | done |
| `generateCrashlockWithOutline` | done |
| `match-body-outline` 门禁（≥8/~11，norm≤0.06） | done |
| `body_outline_cutting_correspondence` | **passed** |
| lock / top 门禁 | **passed**（保留） |
| `holdout_full_crashlock_topology` | **blocked**（`curve_approx_and_degenerate_segments_remain`） |

## Holdout

- 冻结：`100×80×90`
- 外框匹配：见 `body-outline-match.md`

## 明确未做

- 零长度退化段
- 精确 cubic path
- 材料厚度
- 完整 63 计数硬门禁 / 投产宣称

## 产物

- `proto-crashlock-*-outline.svg`
- `reports/body-outline-match.json` / `.md`
