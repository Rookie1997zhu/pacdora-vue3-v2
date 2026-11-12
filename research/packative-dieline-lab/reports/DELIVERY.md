# 顶翼/胶翼几何（第二刀）交付

## 范围

- 仅 research lab `productbox-crashlock`
- 参数化 L/W/H → 顶尘翼 + 插舌 + 胶翼外切，合并锁底第一刀
- **不是**完整 63/14 复刻，**不是**可投产

## 实现

| 项 | 状态 |
|---|---|
| `topFlapFeatures.ts`（dust=`W/2`，tip=`0.6W+1` mm 等） | done |
| `generateCrashlockWithTopFlaps` | done |
| `match-top-flaps` 门禁（holdout ≥22/~26，norm≤0.06） | done |
| `top_flap_cutting_correspondence` | **passed** |
| `lock_bottom_cutting_correspondence` | **passed**（保留） |
| `holdout_full_crashlock_topology` | **blocked**（`top_and_lock_partial_not_full_topology`） |
| cubic 圆角 | `curve_approx` |

## Holdout

- 冻结：`100×80×90`
- 顶翼/胶翼匹配：见 `top-flap-match.md`
- 压力行 `120×90×60`：记录于同报告

## 明确未做

- 体侧外框 / 背板顶边收尾
- 底折小圆角 path
- 精确 cubic
- 完整 Cutting=63 拓扑宣称

## 产物

- `data/normalized/prototype-svg/proto-crashlock-*-topflaps.svg`
- `reports/top-flap-match.json` / `.md`
- `reports/gaps.md` / `next-actions.md`
