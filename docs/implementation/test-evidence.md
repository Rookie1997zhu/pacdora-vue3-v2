# Test Evidence

状态仅用：Passed / Failed / Blocked / Not Run / Not Applicable。

## P0 — 可运行基线（2026-11-10）

| ID | 场景 | 命令 | 结果 | 证据 |
|----|------|------|------|------|
| QA01-build | 生产构建 | `npm run build` | **Passed** | exit 0；`dist/index.html` 生成 |
| QA01-check | 全量自检 | `npm run check:all` | **Passed** | 10 步全部通过；rea-golden checked=2 skipped=14 |
| QA02-catalog | 47 导入 ID | check-catalog | **Passed** | `47 imported sizes, mapped=47` |

**HEAD**：`59ae1f8`（P0 起点）；其后为本地增量未提交。

## P1 — 全栈骨架（2026-11-10）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P1-build | 前端路由后构建 | `npm run build` | **Passed** | LegacyLab 懒加载 chunk；账户页分离 |
| P1-check | 旧自检回归 | `npm run check:all` | **Passed** | 与 P0 同绿，未删断言 |
| P1-auth-csrf | 无 CSRF 登录拒绝 | `python manage.py test tests.test_auth_org` | **Passed** | `test_login_requires_csrf` → 403 CSRF |
| P1-auth-flow | 注册→me→退出→401 | 同上 | **Passed** | `test_register_login_me_logout` |
| P1-org | 跨组织拒绝 | 同上 | **Passed** | `test_cross_org_forbidden` → 403 FORBIDDEN |
| P1-api404 | 未知 API JSON 404 | 同上 | **Passed** | `test_api_unknown_json_404`；`code=NOT_FOUND` |
| P1-geom-unit | 几何核心单测 | `node --test services/geometry/test/validate.test.mjs` | **Passed** | 2/2 |
| P1-geom-http | geometry HTTP | 临时起 `server.mjs` + fetch | **Passed** | health ok；validate face_count=19；unknown → `UNKNOWN_TEMPLATE` 400 |
| P1-compose-build | Compose 构建 geometry 镜像 | `docker compose ... build` | **Passed** | 见 Infra；Hub 仍失败时 DaoCloud + `NODE_IMAGE` 覆盖 |
| P1-media | Caddy `/media` 404 | Compose 全栈 | **Passed** | 见 Infra-media |

## Infra — Compose 全栈冒烟（2026-11-10）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| Infra-pull | 基镜像拉取 | `docker pull node:22-alpine` | **Blocked→绕过** | Hub size validation `28189 != 27791`；`docker.m.daocloud.io/library/node:22-alpine` 成功 |
| Infra-build | compose build | `--env-file deploy/.env -f deploy/compose.yaml build` | **Passed** | geometry/caddy/backend 镜像 Built |
| Infra-up | migrate + up | maintenance migrate；`up -d` | **Passed** | postgres/redis/geometry/backend/caddy healthy；worker celery ready |
| Infra-api | Caddy→API | `node deploy/scripts/compose-smoke.mjs` | **Passed** | health `code=OK`；products items=9 |
| Infra-media | `/media` 私有 | 同上 | **Passed** | `/media/...` → 404 |
| Infra-spa | SPA | 同上 | **Passed** | `/` 含 `#app` |
| P1-admin | Admin 管理 User/Org | 代码+迁移就绪；未人工点选 | **Not Run** | `apps/accounts/admin.py`、`organizations/admin.py` 已注册；本地可用 `createsuperuser` |
| P1-legacy-browser | 浏览器打开 `/` `/lab` | 未跑 E2E 浏览器 | **Not Run** | 构建含 LegacyLab；需 `npm run dev` 目视 |

## P2 — 产品 / 资产 / 设计版本（2026-11-10）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P2-products | 公开产品列表含 parametric + fixed_snapshot | `python manage.py test tests.test_assets_designs` | **Passed** | `test_product_list_published`；`seed_catalog` 注册两类能力 |
| P2-asset-upload | 上传 PNG → 鉴权下载 | 同上 | **Passed** | `test_asset_upload_and_auth_download`；Content-Type `image/png` |
| P2-asset-cross-org | 跨组织读 asset/content → 403 | 同上 | **Passed** | `test_cross_org_asset_forbidden`；`code=FORBIDDEN` |
| P2-design-reopen | 创建设计→上传图层→保存 revision→新会话复开 | 同上（mock geometry validate） | **Passed** | `test_design_create_save_reopen`；params/assetId/geometryHash 一致 |
| P2-conflict | 双请求同 `row_version` → 一成功一 409 | 同上 | **Passed** | `test_row_version_conflict`；`DESIGN_VERSION_CONFLICT` + 当前 `row_version` |
| P2-idempotency | 同 Idempotency-Key 重放相同 revision_no | 同上 | **Passed** | `test_idempotency_replay`；Revision 行数不增 |
| P2-design-cross-org | 跨组织读 design → 403 | 同上 | **Passed** | `test_cross_org_design_forbidden` |
| P2-asset-gate | 外 org / 未 ready assetId → 400 | 同上 | **Passed** | `ASSET_NOT_FOUND` / `ASSET_NOT_READY` |
| P2-build | 前端产品/设计页构建 | `npm run build` | **Passed** | Products/Designs/DesignEditor chunks 生成；LegacyLab 仍懒加载 |
| P2-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 10 步全绿；未破坏旧断言 |
| P2-admin | Admin 管 Product/Asset/Design | 代码就绪 | **Not Run** | `apps/*/admin.py` 已注册；需 `createsuperuser` 目视 |
| P2-browser | 浏览器闭环 | geometry`:3100` + Django`:8000` + Vite`:5173` | **Passed** | 注册→产品→创建设计 L=318→改尺自动保存→上传 PNG 图层→硬刷新 L=321+assetId 一致；`import-102040` 尺寸锁定；修 CSRF 信任源含 `:5173` |
| P2-api-live | 本机 API 冒烟 | PowerShell session 对 `:8000` | **Passed** | 注册/产品(9)/create/upload/save/reopen/fixed_snapshot；content 200 |

## P3 — Studio 首片（2026-11-10）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P3-build | Konva Studio 构建 | `npm run build` | **Passed** | DesignEditor + knife chunk；vue-konva 入包 |
| P3-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 全绿 |
| P3-canvas | 刀版 Konva 渲染 | 浏览器 `/designs/:id` | **Passed** | stage 含 face:* Line；选中 `front` |
| P3-upload-panel | 选面板上传→自动保存→复开 | 同上 | **Passed** | `p3b.png` 写入 front；row 6；刷新后图层仍在；尺寸输入因有图层锁定 |
| P3-3d-uv | 3D UV 贴图 | — | **Passed** | 见 P3.3 |
| P3-text-shape | 文本/形状工具 | — | **Passed** | 见 P3.2 |

## P3.2 — Studio 2D 创作工具（2026-11-10）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P32-schema-api | text/shape/crop revision + 畸形拒绝 | `python manage.py test tests.test_assets_designs` | **Passed** | `test_text_shape_crop_revision`；合法 201；缺 text 字段 / 越界 crop → `VALIDATION_ERROR`；套件 9/9 |
| P32-api-live | 本机 API 保存复开 | `_tmp_p32_smoke.py` → `:8000` | **Passed** | design `15ba158f…` row=3；text=`P32Text` shape=`ellipse` cropW=`0.8` |
| P32-build | ToolRail/多类型画布构建 | `npm run build` | **Passed** | DesignEditor chunk 含新面板 |
| P32-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 10 步全绿 |
| P32-browser-reopen | 文本+形状+裁剪→保存→硬刷新 | 浏览器 `/designs/6dd3d772…` | **Passed** | row 7；kinds 含 `text:P32浏览器` `shape:rect` `image:crop0.7`；图层列表显示 kind |
| P32-draft | IndexedDB 草稿恢复/冲突 | 浏览器写草稿后 reload | **Passed** | 同 row → `recover` 文案；较低 row → `server_newer`；accept 后 content=`草稿恢复验证` |
| P32-size-lock | 有图层禁改尺 | 编辑器 UI | **Passed** | P3.2 时锁定；P3.3 已改为可迁移 |

## P3.3 — Studio 3D UV + 改尺迁移（2026-11-10）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P33-resize-unit | 三策略迁移断言 | `node scripts/check-artwork-resize.mjs` | **Passed** | keep_mm 不变；scale 位置/尺寸×2；anchor 中心钉住 |
| P33-build | 含 FoldPreview 构建 | `npm run build` | **Passed** | DesignEditor + knifeScene chunk |
| P33-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 全绿 |
| P33-size-migrate | 有图层改 L | 浏览器 `/designs/6dd3d772…` | **Passed** | editable=true；L 321→341；scale 文本 x/w 放大；keep_mm 形状 x 不变 |
| P3-3d-uv | 3D 图稿折叠预览 | 同上点 3D | **Passed** | WebGL canvas 728×452；折叠滑条→60%；无 bake 错误 |
| P32-size-migrate | scale/anchor 策略 | 同上 + unit | **Passed** | Selection 可设 policy；迁移生效 |

## P3.4 — 3D 选面板（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P34-pick | knifeScene raycast + 拖拽阈值 | 代码：`pickablePanel` + pointerup≤4px | **Passed** | `setSelectedPanel` emissive；contents 不可点 |
| P34-sync | 3D 选中 ↔ store ↔ 2D | `StudioFoldPreview` onPanelSelect | **Passed** | 共用 `selectedPanelId`；切回 2D 同面高亮 |
| P34-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 见下方执行 |

## P3.5–P3.8 — Studio 收口（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P35-adapt | 改尺 image → needs_adapt；缺 panel → needs_rebind | `node scripts/check-artwork-resize.mjs` | **Passed** | annotate/migrate 写回；图层不删 |
| P35-ui | LayersPanel/顶栏 banner 操作 | 代码 + i18n | **Passed** | 仍保留 / 重绑 / 清除标记 |
| P36-side | 内外面 2D 过滤 + bake side + 内面镜像 | `artworkBake`/`StudioCanvas2D`/`FoldPreview` | **Passed** | AI apply 传 `side` |
| P37-guides | cut/bleed 叠加开关 | `knifeAdapter` paths + 工具条 | **Passed** | 不进 revision；uiPrefs 本地 |
| P38-outbox | outbox 全字段保存复开 | DesignEditor `updateOutbox` | **Passed** | enabled=false 无假装箱标记路径 |
| P35-check | 回归 | `npm run check:all` + resize 脚本 | **Passed** | 见执行记录 |

## P4 — AI Job 首片（2026-11-10）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P4-disabled | provider=disabled → capabilities false + POST 拒绝 | `python manage.py test tests.test_ai_jobs` | **Passed** | `CAPABILITY_UNAVAILABLE`；无 Job/Asset |
| P4-test-gen | test provider 生成成功 + 幂等 | 同上 | **Passed** | status=succeeded；私有 Asset；同 key 不重复 |
| P4-replay | process 重入不双写 | 同上 | **Passed** | Asset/ledger 各 1 |
| P4-cross-org | 跨组织 GET/apply → 403 | 同上 | **Passed** | FORBIDDEN |
| P4-apply | apply 新 revision + 错误 row → 409 | 同上 | **Passed** | layers≥1；`DESIGN_VERSION_CONFLICT` |
| P4-main-area | main_area（P4 首片曾不可用） | — | **Superseded** | 见 P4.1 |
| P4-build | 含 AiPanel 构建 | `npm run build` | **Passed** | DesignEditor chunk 增大含 AI |
| P4-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 全绿 |
| P4-live-openai | OpenAI 真实冒烟 | — | **N/A** | 本片改走 Gemini；OpenAI provider 仍保留 |
| P4-live-gemini | Gemini 真实冒烟 | `python scripts/gemini_live_smoke.py`（env 注入 key） | **Passed** | provider=`gemini`；job=`2370ed54-1862-4a0a-954f-c15316e9fa9c` status=succeeded；asset=`979cd60a-80af-4de4-92ee-737f7ce4b67a`；同 Idempotency-Key 重放同 job；ledger/reservation settled；密钥未写入仓库 |

## P4.1 — main_area / net_mm（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P41-cap | test provider 下 main_area 可用；disabled 双 op 拒绝 | `python manage.py test tests.test_ai_jobs` | **Passed** | capability enabled；ledger `ai_main_area_generate` |
| P41-apply | apply 写 net_mm 整版层；image 仍要 panel | 同上 | **Passed** | `panelId=null`；`aiSettings.mode=main_area`；缺 panel → VALIDATION_ERROR |

## P4.2 — mask/配准（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P42-masks | mailer NetRegistration 非空且 hash 稳定 | `node scripts/check-net-masks.mjs` | **Passed** | printable/total/main + maskHash |
| P42-apply | apply clip=printable + registration 固化 | `python manage.py test tests.test_ai_jobs` | **Passed** | `aiSettings.registration` |
| P42-mismatch | 错误 geometryHash → 400 | 同上 | **Passed** | `GEOMETRY_MISMATCH` |
| P42-ui | 2D/3D printable clip + build | `npm run build` / `check:all` | **Passed** | clip:printable 硬裁切 |
| P41-ui | AiPanel 模式 + 2D/3D net | 代码 + `npm run build` / `check:all` | **Passed** | sheet 坐标；bake face 裁切 |
| P41-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 见执行记录 |

## P5.1 尺寸锁定

| ID | 场景 | 命令/入口 | 结果 | 备注 |
|----|------|-----------|------|------|
| P5-size-lock | fixed 篡改 L → SIZE_LOCKED；规范尺保存成功 | `python manage.py test tests.test_assets_designs` | **Passed** | `import-102040`；无新 revision；`mode=fixed_snapshot` |
| P5-seed-limits | seed locked_dims + parametric limits | 同上（setUp `seed_catalog`） | **Passed** | `fixed-102040` locked_dims；mailer limits=`[80,1200]`；超限仍 `OUT_OF_RANGE` |
| P5-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 全绿；未读 shipping-geom / pacdora 快照 |
| P5-local-limits | geometry mock 放行时本地仍 OUT_OF_RANGE | `python manage.py test tests.test_assets_designs` | **Passed** | L=10；mock 调用次数不增；`param_limits` 回传 |
| P5-ui-limits | 创建/编辑器 min-max + outOfRange i18n | 代码 + `npm run check:all` | **Passed** | ProductDetail/DesignEditor；`studio.outOfRange` |

## P6.1 报价首片

| ID | 场景 | 命令/入口 | 结果 | 备注 |
|----|------|-----------|------|------|
| P6-pending | 无官方规则 → pending_manual | `python manage.py test tests.test_quotes` | **Passed** | `total_amount=null`；客户端假价忽略 |
| P6-valid | 官方规则服务端算价 | 同上 | **Passed** | setup+tiers；忽略 body `total_amount` |
| P6-cross-org | 跨组织 GET quote → 403 | 同上 | **Passed** | FORBIDDEN |
| P6-snapshot | 改尺后旧 quote 快照不变 | 同上 | **Passed** | 绑定 `design_revision_id` |
| P6-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 全绿 |

## P6.2 Cart / Order 首片

| ID | 场景 | 命令/入口 | 结果 | 备注 |
|----|------|-----------|------|------|
| P62-pending | 无官方规则加车→下单 pending_manual | `python manage.py test tests.test_orders` | **Passed** | `total_amount=null`；无假价 |
| P62-quoted | 官方规则 → quoted 汇总 | 同上 | **Passed** | 忽略 body 假金额；`payment_mode=manual_quote` |
| P62-cross-org | 跨 org 读订单/加车 → 403 | 同上 | **Passed** | FORBIDDEN |
| P62-idem | 同 Idempotency-Key 只一单 | 同上 | **Passed** | 重放 200「幂等重放」 |
| P62-snapshot | 下单后改设计不影响 items_snapshot | 同上 | **Passed** | 绑定下单时 revision |
| P62-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 全绿 |

## P6.3 订单确认态 + 人工报价

| ID | 场景 | 命令/入口 | 结果 | 备注 |
|----|------|-----------|------|------|
| P63-manual | pending → manual-quote → quoted | `python manage.py test tests.test_orders` | **Passed** | 汇总行金额；snapshot 价字段更新 |
| P63-confirm | quoted → confirmed；重复 confirm 400 | 同上 | **Passed** | `INVALID_STATUS` |
| P63-cancel | pending/quoted 可取消；confirmed 不可 | 同上 | **Passed** | 400 `INVALID_STATUS` |
| P63-conflict | stale `expected_row_version` → 409 | 同上 | **Passed** | `ORDER_VERSION_CONFLICT` |
| P63-cross-org | 跨 org manual-quote → 403 | 同上 | **Passed** | FORBIDDEN |
| P63-check | LegacyLab 回归 | `npm run check:all` | **Passed** | 见下方执行 |

## 恢复点

- 后端：`backend/` + SQLite；迁移含 `catalog.0001`、`assets.0001`、`designs.0001`、`ai_jobs.0001`、`quotes.0001`、`orders.0001`
- Schema：`packages/design-schema/`
- Studio：`src/studio/`（draft / artworkResize / artworkBake）、`StudioFoldPreview`、ToolRail 面板、报价/购物车
- 几何：`services/geometry/server.mjs`（parametric 保存时由 designs 服务调用 `/validate`）；Django 本地 limits 先拦；fixed 走 `SIZE_LOCKED`
- 部署：`deploy/compose.yaml`、`Dockerfile.*`、`Caddyfile`、`env.example`；私有 media 走鉴权 API，不经 Caddy file_server
- 下一步：生产 TLS；完整印前延后；支付/webhook 可选（`B-GEOM-LICENSE` 仍 Open）；P4.3/P8.2 已 Done

## P4.3 — 多模态 mask 首片（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P43-reg | main_area 缺 registration → 400；hash 不符 → GEOMETRY_MISMATCH | `python manage.py test tests.test_ai_jobs` | **Passed** | create 校验 |
| P43-mask | process 传 mask_png；raster 含白像素 | 同上 | **Passed** | Pillow PNG；TestProvider kwargs |
| P43-gemini | Gemini payload parts 含 inlineData | 同上 | **Passed** | mock requests |
| P43-clip | apply 仍 clip:printable | 同上 | **Passed** | 回归 |
| P43-live | Gemini live image + main_area+registration | `python scripts/gemini_live_smoke.py` | **Passed** | `mask_input=True`；main_area succeeded + `meta.maskHash`；image 幂等 |
| P43-compose | Compose 内 Gemini main_area | deploy `.env` `AI_PROVIDER=disabled` | **N/A** | 以本机 live 为准 |
| P43-excl | 排除项 | 文档 | **N/A** | 无印前/CMYK/image_edit/白墨 |

## P4.3/P8.2 — 档位 2+3 运行时验收（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| V-unit | ai_jobs + thumbnails 回归 | `manage.py test tests.test_ai_jobs tests.test_thumbnails` | **Passed** | 15/15 |
| V-p43-live | 见 P43-live | gemini_live_smoke | **Passed** | SMOKE_PASS |
| V-p82-local | 本机 eager 上传→thumbnail | Django Client PNG | **Passed** | 201 `thumbnail_ready`；GET thumbnail 200 webp |
| V-p82-compose | rebuild worker + Caddy 缩略图 ACL | `compose build/up` + `compose-smoke.mjs` | **Passed** | queues 含 `media`；thumbnail 96B webp；unauth 401；`/media` 404 |

## P8.2 — 异步缩略图首片（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P82-deriv | 上传 PNG → eager 后 `thumb_256` | `python manage.py test tests.test_thumbnails` | **Passed** | `AssetDerivative` + webp 文件；`thumbnail_ready` |
| P82-acl | thumbnail 鉴权 200 / 跨 org 403 / 无 deriv 404 | 同上 | **Passed** | `FORBIDDEN`；`THUMBNAIL_NOT_READY` |
| P82-list | 设计列表 `preview_asset_id`/`thumbnail_ready` | 同上 | **Passed** | 首个 READY image 层 |
| P82-build | 前端构建含预览组件 | `npm run build` | **Passed** | `AuthThumbnail` / DesignsPage / CartPage chunks |
| P82-excl | 排除项 | 文档 | **N/A** | 无 3D cover / 再生成按钮 / `/media` 直出 |
| P82-compose | worker `media` + Caddy 鉴权 thumbnail | 见「档位 2+3 运行时验收」 | **Passed** | compose-smoke 扩展 |

## P8.1 — Compose 部署验收（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P81-health | health + products + SPA | `node deploy/scripts/compose-smoke.mjs` | **Passed** | `code=OK`；products items=9；`#app` |
| P81-media404 | Caddy `/media` 404 | 同上 | **Passed** | `/media/compose-smoke-probe.bin` → 404 |
| P81-media-acl | 鉴权上传/下载；未鉴权拒 | 同上（`SMOKE_*`） | **Passed** | upload 201；content 70B；unauth 401 |
| P81-worker | celery inspect ping | smoke + compose healthcheck | **Passed** | worker `healthy`；pong |
| P81-recreate | force-recreate backend 卷保留 | `up -d --force-recreate --no-deps backend` | **Passed** | health/products 仍可用 |
| P81-excl | 排除项 | 文档 | **N/A** | 无 TLS/支付/印前（缩略图见 P8.2） |

## P7.1 — 校样导出 vector_proof（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P71-mfg | manufacturing → 422 无 Asset | `python manage.py test tests.test_exports` | **Passed** | `MANUFACTURING_BLOCKED` |
| P71-formats | svg/dxf/pdf succeeded + download | 同上（mock geometry） | **Passed** | 文件头校验；hash 与 revision 一致 |
| P71-idem | 幂等重放 / 冲突 | 同上 | **Passed** | 200 同 id；不同 payload 409 |
| P71-acl | 跨 org 403；上传拒 svg | 同上 | **Passed** | `store_bytes` 仅 export |
| P71-ui | ExportPanel + build | `npm run build` / `check:all` | **Passed** | DesignEditor 右侧栏 |

## P7.2 — 制造门禁（2026-11-11）

| ID | 场景 | 命令 / 方法 | 结果 | 证据 |
|----|------|-------------|------|------|
| P72-cap | 无 capability → 422 | `python manage.py test tests.test_exports` | **Passed** | failed_checks 含 CAPABILITY |
| P72-approx | cutApprox → 422 | 同上 | **Passed** | failed_checks 含 APPROX |
| P72-approval | 无 TemplateApproval → 422 | 同上 | **Passed** | failed_checks 含 APPROVAL |
| P72-ok | gate 通过 → manufacturing succeeded | 同上（mock validate/export） | **Passed** | manufacturing_ready + license open |
| P72-ui | ExportPanel 制造档 + check:all | `npm run check:all` | **Passed** | 能力驱动按钮 |
