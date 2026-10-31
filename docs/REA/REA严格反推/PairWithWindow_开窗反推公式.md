# PairWithWindow 开窗反推公式

> 日期：2026-10-29  
> 锚点：列表 id `138` / num `100014` / `modeCate.code = PairWithWindow`  
> 方法：与无窗 `Pair`(list `6`) 对照 + 五组 LWH 严格 knife 差分  
> 金样：`data_search/exports/formula_diff/rea_strict_window/`  
> 脚本：`data_search/_rea_strict_window_diff.py`

---

## 1. 结论

1. 开窗几何在**服务端**生成；相对 `Pair` 多一组 openParams：`X1,X2,Y3,Y4,XR`，并在面片 **`F`** 上多 **1** 组 `holes`（窗洞）。  
2. 窗洞 bbox **相对 F 已闭合**（五组 `all_checks_passed=true`）。  
3. 管式骨架 / 插锁参数与 `Pair` 同族（`G,C,AX…`）；开窗是 **基模 + 特征**。

---

## 2. openParams（开窗组）

| code | 含义（API description） | 几何落点 |
|------|-------------------------|----------|
| X1 | 开窗 X 方向定位 | 布局辅助（绝对系）；生成相对 F 时可不依赖 |
| X2 | 开窗 X 方向宽 | `hole.w = X2` |
| Y3 | 开窗 Y 方向定位 | `hole.y_rel_F = Y3`（距 F 顶边） |
| Y4 | 开窗 Y 方向高 | `hole.h = Y4` |
| XR | 开窗倒角 | 路径圆角；bbox 仍轴对齐 |

默认比例（五组观测，作初值）：

```text
X2 / W  ≈ 0.93～1.0   # 常 ≈W 或 W-5
Y3 / H  ≈ 0.217～0.225
Y4 / H  ≈ 0.433～0.453
XR      ≈ 4～7（随尺寸缓增）
```

---

## 3. 窗洞相对 F 的闭式

令刀版 `L,W,H`，前板 `F` 尺寸 `F.w=L`，`F.h=H`（与 Pair 一致）：

```text
hw = X2
hh = Y4
x_rel = (F.w - hw) / 2     # 水平居中
y_rel = Y3
# 绝对坐标：
hole.x = F.x + x_rel
hole.y = F.y + y_rel
hole.w = hw
hole.h = hh
```

验证（摘要）：

| L×W×H | X2 | Y3 | Y4 | rel (x,y,w,h) | PASS |
|-------|----|----|----|---------------|------|
| 120×60×160 | 60 | 36 | 72.5 | 30, 36, 60, 72.5 | ✓ |
| 100×50×140 | 50 | 31 | 62.5 | 25, 31, 50, 62.5 | ✓ |
| 150×80×180 | 75 | 40 | 80 | 37.5, 40, 75, 80 | ✓ |
| 130×70×150 | 65 | 32.5 | 65 | 32.5, 32.5, 65, 65 | ✓ |
| 200×100×200 | 100 | 43.5 | 87.5 | 50, 43.5, 100, 87.5 | ✓ |

`XR` 进入 hole 路径圆弧，不改变 bbox。

---

## 4. BOXCRAFT 建议

```ts
// generatePairWithWindow = generatePairRTE/STE + window on F
window: { x: (L - X2) / 2, y: Y3, w: X2, h: Y4, r: XR }
```

P0：矩形窗 + 可选圆角。  
P1：与 Pair 插锁槽共存时的避让（当前金样未见窗与锁舌冲突）。

---

## 5. 未闭合 / 非阻塞

| 项 | 状态 |
|----|------|
| 相对 F 的 bbox | **已闭合** |
| 默认 X2/Y3/Y4 精确取整律 | 半开（用比例初值 + min/max） |
| X1 绝对定位代数 | 不阻塞相对 F 生成 |
| cuts 外轮廓逐段 | 金样回归即可 |

合规：仅作自研模板对照，不把 Pacdora cuts 点列载入运行时。
