# Phase 6 — 打样闭环（软件侧 · fefco-0201）

日期：2026-11-13  
范围：`SampleTestRecord` + 证据附件 + 制造门 `SAMPLE` 窄域校验；**无实物打样数据**；**seed 不写入 pass**。

## 交付

| 项 | 说明 |
|---|---|
| App | `apps.samples`（模型 + Staff API `/api/v1/sample-tests/`） |
| 证据 | `store_sample_bytes` → Asset `source=sample` |
| 制造门 | `CAPABILITY + APPROVAL + SAMPLE + GEOMETRY + UNIT + APPROX` |
| Seed | `fefco-0201` 开 `canExportManufacturing` + kraft 厚度审批；**无** SampleTestRecord pass |
| 窄域 | pass 时默认精确匹配实测 L/W/H/T（±0）；不得传播全家族 |

## 测试

| 项 | 状态 |
|---|---|
| `tests.test_sample_tests` + `tests.test_exports` | **Passed**（Ran 25 — OK；含 SAMPLE 拒绝/同规格成功/越域拒绝） |
| 实物打样 | **Not Run** |

## 明确不做

Console UI、伪造已打样、Crashlock/mailer 扩合格、改 engineering 域语义。
