# CurveBox 多边形 / 曲线盒反推入口

> 日期：2026-10-29  
> 锚点：列表 id `12109` / num `18700001` / `CurveBox`  
> 金样：`data_search/exports/formula_diff/rea_strict_curvebox/`  
> 脚本：`data_search/_rea_strict_curvebox_diff.py`

---

## 1. 分轨声明（重要）

| 轨道 | 代表 | list id | 是否「真多边形」 |
|------|------|---------|------------------|
| **本入口** | `CurveBox` | 12109 | 曲线开窗面板盒；LWH 有效 |
| Star* | `StarBox` / `StarBoxSix`… | 5919 / 5969… | **W=0**，边数/极径模型，另开 |
| 勿混淆 | `DoubleDoorLockBottomBoxP1` | 10600 | 双开门锁底，**纸盒面板恒等式**，不是多边形引擎 |

17 类「多边形盒」侧栏混杂上述三轨；BOXCRAFT 映射必须按 `modeCate.code` 分支。

---

## 2. CurveBox 严格差分结论

五组 LWH：`req_equals_knife=true`，`code=CurveBox`。

### 2.1 面片恒等式（稳定）

```text
H = L × W
F = L × W
HT / HB : w = H , h = W
HL : w = L , h = G
```

### 2.2 默认 openParams（五组拟合）

| code | 闭式 / 观测 | 备注 |
|------|-------------|------|
| G | const ≈ 15 | 粘舌高 |
| X | ≈ 0.1 × L | 曲线相关 |
| Y | ≈ 0.05 × L（≈ X/2） | |
| WW | **= 0.6 × W**（五组精确） | 窗/弧宽向量 |
| WL | ≈ 0.62 × L | 窗/弧长向量 |
| WR | ≈ 0.03 × L | 弧倒角 |
| Y | **= X / 2**（五组精确） | |

路径逐段仍用金样回归；上表够 P0 面板 + 参数滑条。

---

## 3. StarBox* 未闭项（入口备忘）

- 刀版常 `W=0`，`openParams` 仅 `N`。  
- 面片数随星角数增加（Six≈55，Eight≈67）。  
- **下一步**（本仓 backlog）：固定 L/H，对比 `StarBoxThree`…`Eight` 的 N 与外接半径，写极坐标生成器；**不**套 CurveBox 公式。

---

## 4. BOXCRAFT

- `templateId` 建议：`curveBoxPanel`（本入口）与 `starBoxPolar`（未做）分离。  
- 禁止把 list `10600` 金样当多边形验收。
