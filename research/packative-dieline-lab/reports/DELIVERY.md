# 锁底几何（第一刀）交付

## 范围

- 仅 research lab `productbox-crashlock`
- 参数化 L/W/H → 锁底 Cutting + 体板 14 Creasing
- **不是**完整 63/14 复刻，**不是**可投产

## 实现

| 项 | 状态 |
|---|---|
| `lockBottomFeatures.ts` 拟合（tipDepth=W/2+5，bigFlap=W+10.5 mm 等） | done |
| `generateCrashlockWithLockBottom` | done |
| `match-lock-bottom` 门禁（holdout ≥18/21，norm≤0.06） | done |
| `lock_bottom_cutting_correspondence` | **passed**（holdout 21/21） |
| `holdout_full_crashlock_topology` | **blocked**（`lock_bottom_partial_not_full_topology`） |
| cubic 圆角 | `curve_approx`（弦/固定缺口） |

## Holdout

- 冻结：`100×80×90`
- 锁底匹配：21/21，medianNorm≈0.0006 → **passed**
- 压力行 `120×90×60`：记录于 `lock-bottom-match.md`

## 明确未做

- 顶尘翼 / 插舌 / 胶翼外轮廓
- 精确 cubic path
- 完整 Cutting=63 拓扑宣称

## 产物

- `data/normalized/prototype-svg/proto-crashlock-*-lockbottom.svg`
- `reports/lock-bottom-match.json` / `.md`
- `reports/gaps.md` / `next-actions.md`
