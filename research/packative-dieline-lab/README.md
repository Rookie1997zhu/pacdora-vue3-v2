# Packative Dieline Lab（离线隔离研究）

独立于 BOXCRAFT 生产业务的刀版研究工具。研究口径：`live_collection=true` 允许未授权 CDN/editor 白名单观察；**始终** `paid_actions=false`（禁止付费导出/下单/邮件）。见 `config/access-scope.json`。

## 依赖与运行

```bash
cd research/packative-dieline-lab
npm install
npm run all
```

分步：

| 命令 | 阶段 |
|---|---|
| `npm run phase1` / `audit` | 证据审计摘要 |
| `npm run import-offline` | 离线登记 SVG/EPS/meta |
| `npm run normalize-svg` | SVG Cutting/Creasing 规范化 |
| `npm run sample-matrix` | 计划样本 vs 本地 available |
| `npm run diff-geometry` | 多样本差分 |
| `npm run online-collect` | 在线桩（本轮 0 条） |
| `npm run infer-rules` | 线性包络规则 |
| `npm run prototype` | 局部 crashlock SVG 原型 |
| `npm run validate` | 留出验收 |
| `npm test` | real/synthetic 单测日志 |

## 证据

- 只读源：`docs/packative-research/evidence/`
- 清单：`reports/evidence-inventory.json`
- 不修改旧报告标签；不提交 `data/private/`

## 交付物

- `reports/`：审计、差分、验收、next-actions
- `data/normalized/`：规范化几何 JSON + `prototype-svg/`
- `data/rules/`：candidate / validated / counterexamples

## 边界

- 不以 PNG/EPS BoundingBox 当刀版尺寸
- 不把约 0.5mm 偏移说成纸厚补偿
- 原型**未**恢复锁底完整拓扑；见 `reports/gaps.md`
