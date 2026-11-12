# 退化段（导出伪影）交付

## 范围

- 仅 research lab `productbox-crashlock`
- 盘点并标注 raw Cutting 中的零长导出伪影；结构切割数门禁（有效 **61**）
- **不是**完整 raw-63 复刻，**不是**可投产

## 实现

| 项 | 状态 |
|---|---|
| `inventory-degenerates` 盘点报告 | done |
| normalize `exportArtifact` + structural 计数 | done |
| `match-structural-cutting`（61==61） | done |
| `structural_cutting_count_correspondence` | **passed** |
| lock / top / outline / curve_exact | **passed**（保留） |
| `holdout_full_crashlock_topology` | **blocked**（`raw_63_includes_export_zero_length_artifacts_not_emitted`） |

## Holdout

- 冻结：`100×80×90`
- raw=63，zero=2，structural=61 ≡ proto cutting
- 见 `degenerate-segments.md` / `structural-cutting-match.md`

## 明确未做

- 在原型中塞零长 stub 凑满 63
- 材料厚度
- raw-63 / 投产宣称

## 产物

- `reports/degenerate-segments.json` / `.md`
- `reports/structural-cutting-match.json` / `.md`
