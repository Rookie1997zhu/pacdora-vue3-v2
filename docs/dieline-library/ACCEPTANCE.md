# BOXCRAFT 刀版相关 — 验收说明

日期：2026-11-12  

## V1.2 主线状态（现行）

依据：[V1.2 方案](../packative-research/BOXCRAFT_Complete_Plan_Fresh_20261112/boxcraft_dieline_library_plan_v1_1/BOXCRAFT_Packative_Lab_Catalog_Plan_V1.2_2026-11-12.md) 与更新后的 [`03_QA_and_Acceptance_Prompt.txt`](../packative-research/BOXCRAFT_Complete_Plan_Fresh_20261112/boxcraft_dieline_library_plan_v1_1/prompts/03_QA_and_Acceptance_Prompt.txt)

| 项 | 状态 |
|---|---|
| Lab Packative 第三源 | **已实现**（`LegacyLab` Packative 页签 + `src/packative/`） |
| crashlock 研究台 → Lab 接线 | **已接线**（`generateCrashlockWithOutline` 2D 回放；不注入 knife） |
| 主线验收 | **通过**（P3；见 [`p3-lab-acceptance.md`](../../research/packative-dieline-lab/reports/p3-lab-acceptance.md) / [`p3-holdout-gates.md`](../../research/packative-dieline-lab/reports/p3-holdout-gates.md)） |

P3 证据摘要：`npm run check:all` / `build` 退出码 0；preview 浏览器烟测 Packative；研究台结构 gates passed；`manufacturingReady=false`。  
后续增量：官方 SVG → Lab 规范 2D；`publish:packative-geom`；旁路归档 **10** 条非 example（见 [`packative-publish-bypass.md`](../../research/packative-dieline-lab/reports/packative-publish-bypass.md)）。扩盒型仍可选未做。

以下正文为 **V1.1 旁路固定原件库** Phase 4 报告；数量口径已在文首「旁路库存更新」覆盖本批导入。

---

# （历史）V1.1 旁路 — Phase 4 独立验收报告

范围：Phase 0–3（`dieline_library` 后端、`/library/dielines` 前台、采集适配器框架）  
角色：独立验收（以命令输出与代码抽查为准）

## 环境

- 工作区：本地 `pacdora-vue3-v2`
- OS：Windows 10
- 后端：Django + `python manage.py test`
- 前端：Node / Vite（`npm run check:*` / `build`）
- Compose / Caddy：配置抽查；**本机未起全套 compose 做 HTTP 实机探测**（记入未运行项）

## 数量口径

| 指标 | 数量 | 说明 |
|---|---:|---|
| 真实入库资产（非 example） | **10** | 本地 evidence → `packative-crashlock-geom-manifest` 导入（validated+holdout）；非真网 `--live` |
| 示例 / fixture | 1 套清单 | [`fixtures/example-manifest.json`](./fixtures/example-manifest.json)（不计库存） |
| 官方 geom 发布物 | **10** | `public/packative-geom/` + catalog `geom_rel` |
| 制造验证通过（`production_ok`） | 0 | 入库默认 `reference_only`，不自动升级 |

## 命令与结果

| 命令 | 退出码 | 摘要 |
|---|---:|---|
| `python manage.py test tests.test_dieline_library tests.test_dieline_acquisition` | 0 | 15/15 OK（后续又补 2 条安全用例，单独 2/2 OK） |
| `npm run check:catalog` | 0 | 47 imported sizes, mapped=47 |
| `npm run check:all` | 0 | topology/fold/contract/export/golden/templates/rea/catalog/geom/outbox/net-masks 全过 |
| `npm run build` | 0 | Vite 生产构建成功；产物含 `DielineLibraryListPage` / `DetailPage` chunk |

### 既有失败基线

本轮 **无** `check:all` / `check:catalog` / `build` 失败项，基线表为空。  
（与刀版库无关的 chunk size 警告不记为失败。）

## 范围与约束核对

| 项 | 结果 | 证据 |
|---|---|---|
| 固定库与 `/lab` 分离 | 通过 | 路由 `/library/dielines`、`/:id`；nav 独立入口 |
| API 在兜底之前 | 通过 | [`urls.py`](../../backend/config/urls.py) `include(dieline_library)` 在 `ApiNotFoundView` 前 |
| worker 含 `import` 消费者 | 通过 | compose `--queues=...,import`；`CELERY_TASK_ROUTES['dieline_library.*']` |
| 无 Beat 定时 Packative | 通过 | 无 dieline 周期任务；默认 policy 已改为 `enabled=true`（永久许可），仍不自动 Beat 爬取 |
| 无 PackFlow 依赖 | 通过 | 业务代码 grep 无 packflow |
| 原件不进 `public`/`dist` | 通过 | `public` 无 svg/eps/dxf/pdf 刀版；`dist` 无此类原件 |
| `/media` 阻断 | 配置通过 | Caddyfile `@private path /media` → `respond 404`（实机 HTTP 未跑） |
| 深链 fallback | 配置通过 | Caddy `try_files {path} /index.html`；路由已注册（实机刷新未跑） |
| 制造状态不自动量产 | 通过 | `import_manifest` 默认 `reference_only`；无 `productionReady` 自动升级逻辑 |

## 权限 / 安全 / 任务（测试证据）

| 场景 | 结果 | 证据 |
|---|---|---|
| 未登录列表 | 通过 | `test_unauthenticated_variants_rejected` → 401 |
| 跨 org 下载 | 通过 | `test_cross_org_download_forbidden` → 403 |
| 无 grant 下载 | 通过 | `test_download_denied_without_rights` → `DOWNLOAD_DENIED` |
| 有内部 grant 下载 | 通过 | `test_download_ok_with_internal_grant` → attachment |
| 脚本 SVG | 通过 | `needs_review`、无 preview |
| example 不计库存 | 通过 | `inventory_count=0` |
| Packative 显式 disabled 门禁 | 通过 | `packative.disabled.json` → `SOURCE_DISABLED`；库存不增 |
| Packative 默认开启+永久许可 | 通过 | `packative.default.json` 门禁通过；无 `--live` 时 execute → `LIVE_FLAG_REQUIRED` |
| Packative CDN 运行时（mock） | 通过 | `test_packative_runtime.py`：dry_run 不计网；合法 SVG 入库；AccessDenied 不增库存；SSRF 拒绝；disabled→`SOURCE_DISABLED` |
| Celery eager 消费 | 通过 | `dispatch_acquisition_job` → succeeded |
| ZIP 路径穿越 | 通过 | `test_supplier_zip_path_traversal_rejected` → `ZIP_PATH_TRAVERSAL` |

## 通过项

- Phase 1–3 后端/采集自动化测试通过
- 前端 check/build 通过；库页面进入生产 bundle
- 权限在后端强制；预览/下载 attachment；消毒失败降级
- 在线适配器项目策略改为默认开启+永久许可；CDN crashlock 运行时（REA 契约 + Scrapy/direct）可测；真网需 CLI `--live`；无假库存宣称

## 失败项

无（本轮刀版库范围内）。

## 未运行项

- Compose/Caddy 实机：`/media` HTTP 404、深链刷新、worker 容器实订 `import`
- 浏览器 E2E：登录 → `/library/dielines` UI 点击预览/下载
- 真实获准原件端到端入库与 SHA 人工抽检（无真实文件）
- 备份/恢复全流程
- Packative 实采 / 付费动作 / 401·429 在线策略实网验证
- 客户 A/B 多租户 UI 矩阵、批量 ZIP 导出领取（库未交付批量 ZIP API）
- 几何/DXF/PDF/AI 全量畸形夹具矩阵（超出当前固定原件入库范围；SVG 清洗与伪 HTML 已测）

## 阻断项（相对「对外发布」）

1. **真实库存**：以实际成功入库条数为准；mock 测试可增库存，真网条数不编造。
2. **Packative 真网实采**：运行时已接通；默认需 `--live`；失败不编造成功数。
3. **制造验证 = 0**：不得将框架可用等同量产认证。
4. **实机托管/worker 未在本报告环境复验**（配置已核对）。

## 结论（仅 V1.1 旁路）

**旁路固定原件库：可内部试用**

依据：固定刀版库框架（导入 → 元数据/安全预览 → 权限下载 → 采集任务）可测且自动化通过；真实素材与制造验证均为 0，**不构成对外发布或量产认证**。

**V1.2 主线（Packative → Lab）尚未验收通过。** Cursor 旧 phase plans / `packative_online_runtime` 属于旁路阶段，已被 V1.2 取代为实施主线。
