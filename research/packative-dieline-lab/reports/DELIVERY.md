# 锁底 / 顶翼精确 cubic 归属（交付）

## 状态

8 条 holdout 真实单段 cubic 已按几何归属迁入锁底（2）与顶翼（6）；outline 仅直线 leftovers。合片 Cutting 仍 **61**；`holdout_full_crashlock_topology` 仍 **blocked**。

## 实现

| 项 | 状态 |
|---|---|
| `cubicParams.ts` 共享 exact offsets | done |
| lock：2× big-flap `pathCubic` + path 过滤器 | done |
| top：6× 体顶 fillet `pathCubic` + path 过滤器 | done |
| outline：仅 L-底 / 右外 / micro bridge 直线 | done |
| lock/top cubic 残差门禁（≥2 / ≥6，median≤0.06） | **passed** |
| outline cubic 门可选（0 pairs OK） | **passed** |
| structural 61≡61 | 保持 |
| full topology | **blocked**（raw-63 含 Class A 零长） |

## 明确未做

- 把 hook/tuck/glue 真实折角线改成假 cubic
- 发射 Class A 零长 stub / 伪造成 raw-63
- 生产 Vue/Django 接入

## 厚度钩子（上一切片，仍有效）

| 项 | 状态 |
|---|---|
| `thicknessMm` / `kerfMm`（默认 0） | done |
| `t=k=0` 几何恒等 | passed |
| 系数标定 | 未做（样本 `thickness: null`） |
