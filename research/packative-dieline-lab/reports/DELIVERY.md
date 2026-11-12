# 55 零长分类交付

## 范围

- 仅 research lab `productbox-crashlock`
- Class A（maxX∩bodyBottom 导出重复）vs Class B（lock 搁板坍缩）；仅 A 扣 structural
- **不是** raw-63 复刻，**不是**可投产

## 实现

| 项 | 状态 |
|---|---|
| 退化段刀 commit/push | done |
| `degenerateClassify` Class A/B | done |
| structural = raw − Class A | done |
| holdout structural 61≡61 | **passed** |
| `55×55×75` structural 61≡61 | **passed**（记账修正） |
| `holdout_full_crashlock_topology` | **blocked**（`raw_63_includes_export_zero_length_artifacts_not_emitted`） |

## Holdout / 55

- 冻结 holdout：`100×80×90` — raw=63，A=2，B=0，structural=61
- `55×55×75` — raw=63，A=2，B=2，structural=61（B 不扣）

## 明确未做

- 零长 stub 发射
- 为 55 改通用 lock 参数
- raw-63 / 投产宣称

## 产物

- `src/geometry/degenerateClassify.ts`
- `reports/degenerate-segments.json` / `.md`
- `reports/structural-cutting-match.json` / `.md`
