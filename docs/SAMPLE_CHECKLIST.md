# 实物打样对照清单

**未完成打样前禁止投产。`manufacturingReady` 必须保持 `false`（除非制造门全项通过，含 SAMPLE）。**

本表用于人工现场记录；系统侧打样闭环见 Staff API：

- `POST /api/v1/sample-tests/` — 登记（默认 `pending`）
- `POST /api/v1/sample-tests/{id}/evidence/` — 上传证据
- `POST /api/v1/sample-tests/{id}/review/` — `{verdict: pass|fail}`（仅 staff）

当前状态：**未打样**（无 seed pass 记录；软件闭环已就绪）。

软件黄金样例见 `scripts/fixtures/golden.json`；一键自检：`npm run check:all`。  
阶段报告：`research/packative-dieline-lab/reports/phase6-fefco-sample-loop.md`。

## 样例登记（现场）

| 样例 ID | 模板 | 内尺寸 L×W×H (mm) | 厚度 T | 材质 | 打样日期 | 状态 |
|---|---|---|---|---|---|---|
| fefco-anchor | fefco-0201 | 300×200×150 | 3 | kraft | — | 未打样 |
| mailer-default | mailer-parametric-demo | 300×200×50 | 1.5 | kraft | — | 未打样 |

## 现象对照

填写时在「实测」列写数值或描述；「回写状态」取：`未做` / `已改代码` / `已复测`。

| 样例 ID | 现象 | 预期 | 实测 | 建议补偿 | 回写状态 |
|---|---|---|---|---|---|
| fefco-anchor | 缺料 / 张口 / 合盖干涉 | 见工程域 | | 调补偿后重导 engineering | 未做 |

## 回写规则

1. 先改输入参数（L/W/H/T/bleed）复测；仍偏差再改模板补偿。
2. 改几何后必须跑对应 `check:*-engineering` / `npm run check:all`。
3. **不得**因「软件自检通过」将 SampleTestRecord 标为 `pass`；仅在完成实物打样并签字后由 staff review。
4. 一条 pass 只覆盖其窄域尺寸，不得传播到全家族。
