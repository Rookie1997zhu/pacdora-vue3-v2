# 顶翼 tuck inset 厚度接线（交付）

## 状态

`thicknessMm` / `kerfMm` 已接到顶翼 tuck inset 与 tipAdd；仍为 **unvalidated sensitivity**。`t=k=0` 恒等；full topology 仍 **blocked**。

## 实现

| 项 | 状态 |
|---|---|
| `applyTopMaterialHooks` | done |
| `thicknessMm` → `tuckOuter/InnerInsetMm` | done |
| `kerfMm/2` → top `tipAddMm` | done |
| crashlock 传入 `buildTopFlapSegments` | done |
| thickness-sensitivity tuck 列 | done |
| `t=k=0` 恒等 + 合成位移断言 | done |
| dust / fillet / glue 厚度钩 | **未做** |
| 系数标定 | **未做** |

## 明确未做

- 从样本拟合 caliper/kerf
- 生产 Vue/Django 接入
- 伪造成 raw-63 / full topology passed
