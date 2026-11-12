# 旧结论纠正表（阶段 1）

说明：下列摘自 `docs/packative-research/README.md` 与 `05-参数化刀版几何算法研究.md`。标签含义：

- `observed`：本轮可在本地原始文件直接核对
- `report_only`：仅旧报告记载，本轮未在线复测
- `needs_recheck`：线索有用但不足以当合约/公式真理
- `clue_not_contract`：接口形态线索，禁止当公开 API 合约或重放授权

| 旧断言 | 标签 | 本轮说明 |
|---|---|---|
| Studio SVG 含 `ev-style=Cutting\|Creasing` | `observed` | 本地 crashlock SVG 可直接读到该属性 |
| crashlock 多尺寸 SVG 同拓扑（Cutting=63 / Creasing=14） | `needs_recheck` | 旧报告数值；由阶段 2 normalize 统计复核 |
| `GET .../v1/editor/dieline?product&length&width&height` | `clue_not_contract` | 旧证据链路；字段名见本地 meta；本轮允许未授权观察，不复用登录 Cookie |
| `GET papi.../public/online/model?...&format=eps` | `clue_not_contract` | 商品页 EPS 链路线索；EPS 不作刀版尺寸 |
| meta 含 `original_svg_url` / masks / canvas_* | `observed` | 见 `studio-api-dieline-100_80_80.meta.json`（本轮直接读取） |
| CDN 部分尺寸 403=缓存未命中 | `needs_recheck` | 禁止武断解释；可在白名单未授权 GET 下继续观察 |
| robots 禁止 `/editor/` 等 | `corrected` | 旧 README 记载 robots；**本 lab 研究口径允许未授权爬**（见 `config/access-scope.json`）；仍禁付费/下单/邮件 |
| 尺寸为内部尺寸 | `report_only` | 官网宣传记载；采集时仍应逐入口核对 |
| EngView 风格字段 ⇒ 全站 EngView | `needs_recheck` | 方案已否定外推；本轮不据此推定 provider |
| ~0.5mm 偏移 = 纸厚补偿 | `needs_recheck` | **明确拒绝**作为已确认规则 |
| EPS BoundingBox = 刀版尺寸 | `needs_recheck` | **禁止**代替几何尺寸 |

## 本轮可处理向量样本（本地）

见 `reports/evidence-inventory.json`：磁盘上有 7 个 `studio-dieline*.svg` 文件名，但其中 **3 个是 CDN `AccessDenied` XML 占位**（约 111 字节），不是刀版：

- 可用：`100_80_80`（两份同内容）、`55_55_75`、`200_150_100`
- 占位不可用：`100_80_50`、`120_90_60`、`300_200_150`

因此旧报告中“多尺寸 SVG 均已取证”对上述占位尺寸应降级为 `needs_recheck` / 实际不可解析。
