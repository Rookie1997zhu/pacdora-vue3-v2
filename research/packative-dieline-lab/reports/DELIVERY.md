# 阶段 1–4 交付说明（离线）

## 交付路径

`research/packative-dieline-lab/`

## 真实完成范围

| 阶段 | 状态 | 要点 |
|---|---|---|
| 1 审计 | Done | REA 工具实录、git HEAD、SHA 清单 50 文件、访问范围、旧结论纠正 |
| 2 工具 | Done | 离线导入/SVG 规范化/矩阵/差分/在线桩；**在线采集 0** |
| 3 规则+原型 | Partial | 拓扑 Cutting=63/Creasing=14 稳定；宽度包络模板 holdout 可通过；高度公式 holdout 失败已记反例；锁底未实现 |
| 4 验收 | Done | 真样本/合成单测分离；隐私扫描无命中；`validation-report.md` |

## 关键发现

- 本地 7 个 `studio-dieline*.svg` 中 3 个为 CDN **AccessDenied** 占位（不可当刀版）
- 真实可用尺寸仅：`55×55×75`、`100×80×80`、`200×150×100`
- 单位候选 `25.4/96` mm/uu 有折缝跨度旁证，但仍标为 candidate

## 失败 / 未运行

- `holdout_envelope_height`: **failed**（~76 uu）
- `holdout_full_crashlock_topology`: **not_run**
- 矩阵大量点 `missing_offline`（无授权在线补样）

## 剩余风险

- 样本过少 → 宽度模板可能过拟合；高度不可用
- 未做业务集成；未宣称生产可用
- 条款/robots 未本轮在线复测（遵守旧记录默认离线）

## 复现

```bash
cd research/packative-dieline-lab
npm install
npm run all
```
