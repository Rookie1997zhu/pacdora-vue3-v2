# Implementation Progress

## Restore point

- **起点 HEAD**：`59ae1f8637f19cc655562bb2029fcb4fddcccd7f`
- **阶段**：P0–P5.2 Done · P3.4–P3.8 Done · P6.1–P6.3 Done · P4 Gemini 冒烟 Done · P4.1–P4.3 main_area/mask/多模态 Done · P7.1–P7.2 导出 Done · P8.1 Compose 验收 Done · P8.2 异步缩略图 Done · **V1 Paper Lab 外观 Done**（`B-AI-KEY` Resolved；`B-GEOM-LICENSE` 仍 Open）
- **下一步**：生产 TLS（凭据另开）；完整印前延后；支付/webhook 可选；`B-GEOM-LICENSE` 仍 Open；像素级视觉对照可选
- **运行时验收**：P4.3 Gemini main_area+mask live **Passed**；P8.2 Compose `media` 队列 + 鉴权 thumbnail **Passed**（Compose 内 AI 仍 `disabled` → P4.3 Compose N/A）；Paper Lab `npm run build` **Passed**

## Timeline

| 阶段 | 状态 | 说明 |
|------|------|------|
| V1 Paper Lab 外观 | Done | tokens/base；LegacyLab `.legacy-lab` 隔离；AppShell；Home/Products/PDP/Designs/Cart/Orders/Account；Studio 顶栏+ToolRail 壳；墨色 CTA + 钢青信号；无 Packative 紫 |
| P0 基线纠偏 | Done | `docs/implementation/*` + build/check:all |
| P1 全栈骨架 | Done | LegacyLab、Router/Pinia、Django 认证/组织、geometry、deploy 样板落地 |
| P2 产品/资产/设计版本 | Done | catalog/assets/designs、私有上传、Revision 乐观锁+幂等、产品/设计前端壳 |
| P3 Studio 首片 | Done | Konva 2D 刀版画布、面板上传、图层/历史、自动保存 |
| P3.2 Studio 创作工具 | Done | 文本/形状/裁剪、面板 clip、ToolRail+属性栏、IndexedDB 草稿 |
| P3.3 Studio 收尾 | Done | 3D 图稿烘焙预览 + 折叠；parametric 改尺按 resizePolicy 迁移 |
| P3.4 3D 选面板 | Done | 3D raycast 点选 face → 与 2D 共用 `selectedPanelId`；拖拽不误选 |
| P3.5 图层治理 | Done | `sourceGeometryHash`/`adaptStatus`；改尺 needs_adapt；缺面板 needs_rebind；banner 操作 |
| P3.6 内侧印刷 | Done | `editSide` 内外切换；2D 过滤；bake `{side}` + 内面水平镜像；AI apply 写 side |
| P3.7 出血/刀线 | Done | Studio 2D 叠加 cut/bleed 开关；uiPrefs 本地记忆 |
| P3.8 Studio 外箱 | Done | DesignEditor outbox 全字段读写/复开；enabled=false 不假装箱；3D 启用标记 |
| P4 AI Job 首片 | Done | `image_generate` 异步竖切 + 能力门禁；无密钥不伪造成功；Studio AiPanel |
| P4 Gemini 冒烟 | Done | `GeminiImagesProvider`；live `image_generate` succeeded + 幂等；默认模型 `gemini-2.5-flash-image` |
| P4.1 main_area / net_mm | Done | `main_area_generate` 能力开放；apply 写 net_mm 整版层；2D sheet + 3D face 裁切 |
| P4.2 mask/配准 | Done | `NetRegistration` + clip:printable 硬裁切；registration 固化；无 Gemini 多模态 |
| P4.3 多模态 mask | Done | main_area 创建带 registration；Pillow 栅格 mainMask → Gemini inlineData |
| P7.1 校样导出 | Done | `apps.exports` + geometry `/export`；svg/dxf/pdf vector_proof；manufacturing 422 |
| P7.2 制造门禁 | Done | TemplateApproval + capability + approx 闸门；manufacturing 可过闸；无 CMYK/ICC |
| Infra Compose | Done | 镜像 ARG/镜像源绕过 Hub；geometry deps 修复；Caddy HTTP 本地冒烟 Passed |
| P8.1 Compose 验收 | Done | worker healthcheck；smoke media-acl + worker ping；bootstrap 验收清单 |
| P8.2 异步缩略图 | Done | Pillow `thumb_256` + media 队列；鉴权 thumbnail；列表/购物车预览 |
| P5.1 尺寸锁定 | Done | `fixed_snapshot` 服务端 `SIZE_LOCKED`；seed `locked_dims` + parametric limits |
| P5.2 limits 闸门 | Done | Django 本地 `OUT_OF_RANGE` + 设计详情 `param_limits` + 前端 min/max |
| P6.1 报价首片 | Done | Quote + PricingRuleVersion；无官方规则 → `pending_manual`；编辑器询价 |
| P6.2 Cart/Order | Done | Cart/Order 快照下单；无 valid 报价 → `pending_manual` + `total_amount=null` |
| P6.3 确认态 | Done | 人工报价回填 → `quoted`；确认/取消；订单详情可操作 |

## V1 Paper Lab 主要新增

- 令牌：`src/styles/tokens.css` + `base.css`（Sora / IBM Plex Sans / Noto SC·KR；纸面白、墨色 CTA、钢青 `#2A6F7A`）
- 隔离：原全局 `style.css` 规则迁入 `legacy-lab.css` 并前缀 `.legacy-lab`；`LegacyLab` 根节点加 class
- 壳：`components/layout/AppShell.vue`；营销/商务页统一白顶栏 + 浏览产品 CTA
- Studio 壳：`DesignEditorPage` 顶栏/侧栏边框字色；`ToolRail` 竖轨选中态；不改 Konva/Three/保存/AI 逻辑
- 验收：`npm run build` Passed；手测旅程 Home→Products→Design→Studio→Cart 壳层一致；`/lab` 保留

## P3.4 主要新增

- `knifeScene`：panel mesh `pickablePanel` + Raycaster 点击拾取（位移≤4px）；`setSelectedPanel` emissive 高亮
- `StudioFoldPreview`：`onPanelSelect` → `design.selectPanel`；与 2D 双向同步选中；i18n `studio.pickPanel3d`
- 边界：3D 不直接编辑图层；折叠进度仍仅视图态；装箱内容物不可点选

## P3.5–P3.8 主要新增

- P3.5：`ArtworkLayer.sourceGeometryHash`/`adaptStatus`；`artworkResize` annotate/migrate 写回；LayersPanel/顶栏待处理；不静默删层
- P3.6：2D/3D 外内面；`bakeArtworkMaps(doc,{side})`；Selection `side`；AI apply `side`
- P3.7：`knifeAdapter` cut/bleed paths；StudioCanvas 开关；`boxcraft.studio.uiPrefs`
- P3.8：outbox `sizingMode/fixedInner/manualLayout/thickness` 持久化复开；3D「外箱已启用」徽章
- 延后：白墨；完整印前；异步缩略图见 P8.2；多模态见 P4.3

## P4.1 主要新增

- 能力：`main_area_generate` 与 image 共用 provider/key 门禁；process 复用 `generate_image`（可选版式 prompt 后缀，无 mask）
- Apply：client 传刀版 AABB → `coordinateSpace:net_mm`、`panelId:null`、`aiSettings.mode=main_area`
- Studio：AiPanel 模式切换；2D sheet 坐标；bake 按 face 裁切 net 图；图库项带 `operation`
- 边界：方图可拉伸至非方 AABB；不做 server mask / Gemini 多模态 / 缩略图再生成按钮

## P4.3 主要新增

- 创建：`main_area_generate` 必填 `registration`（geometryHash 校验）；写入 `AiJob.meta`
- 处理：Pillow 栅格 `mainMask`（white_printable）→ Gemini `inlineData`；test/openai 忽略 mask
- 能力：`mask_input` 仅 gemini+main_area；Studio generate 提交配准；本地 `clip:printable` 不变
- 边界：无完整印前 / image_edit / 白墨；不宣称 mask 喂入可开模

## P4.2 主要新增

- `netMasks`：`NetRegistration`（total/printable/main 多边形 + maskHash + pxPerMm 约定）
- Studio 2D/3D：`clip:'printable'` 硬裁切；apply 默认 writable printable
- 后端：可选 `registration`；`geometryHash` 不一致 → `GEOMETRY_MISMATCH`；写入 `aiSettings.registration`
- 边界：矢量本地硬裁切；栅格喂供应商见 P4.3

## P7.1 主要新增

- `apps.exports`：ExportJob + `POST designs/{id}/exports/` / `GET exports/{id}/` / `download/`
- geometry `POST /export` 复用 `exportDieline.js`；`store_bytes` 写私有 svg/dxf/pdf（用户上传仍拒）
- Celery `export` 队列路由；作业固化 revision content/geometry hash + exporter_version
- Studio `ExportPanel`（校样 · 不可开模）；`quality_tier=manufacturing` → 422
- 边界：无制造档、无 1:1 生产 PDF、LegacyLab 本地下载不变

## P7.2 主要新增

- 门禁：`evaluate_manufacturing_gate`（`canExportManufacturing` + `TemplateApproval` + 无 cutApprox/bleedApprox）
- seed：`mailer-parametric-demo` 能力 + 批准记录；geometry preflight 回传 approx；Job.preflight 记 license Open
- Studio：能力驱动制造档按钮；失败码 `MANUFACTURING_BLOCKED` / `APPROX_BLOCKED`
- 边界：无 CMYK/ICC/字体/PPI/EPS；`B-GEOM-LICENSE` 仍 Open；不宣称 1:1 生产 PDF

## P8.2 主要新增

- 依赖：`Pillow`；`store_derivative_bytes` + `assets.generate_thumbnail`（queue `media`）
- 上传/保存后 outbox `asset.thumbnail_requested` + on_commit enqueue；幂等 `AssetDerivative(kind=thumb_256)`
- API：`GET /api/v1/assets/<id>/thumbnail/`（org 鉴权；未就绪 `THUMBNAIL_NOT_READY`）；Asset/DesignList/CartItem 含 `preview_asset_id`/`thumbnail_ready`
- 前端：DesignsPage/CartPage 鉴权 blob 预览 + 中性占位；i18n zh/ko；worker `--queues=...,media`
- 边界：无服务端 3D cover、无再生成按钮、不开放 `/media`

## P8.1 主要新增

- `worker` celery `inspect ping` healthcheck；`compose-smoke` 鉴权 media 正反向 + worker ping（`SMOKE_*` 必填）
- `bootstrap.md` 验收清单 / 卷持久化 / `pg_dump` 备份要点；`env.example` 增 SMOKE 注释
- 边界：无公网 TLS、无支付、无完整印前（缩略图见 P8.2）

## P6.3 主要新增

- 后端：`POST orders/<id>/manual-quote|confirm|cancel`；`expected_row_version` 乐观锁；联动 Quote `manual_fill`
- 规则：仅 pending 可填价；仅 quoted 可确认；pending/quoted 可取消；confirmed 不可取消/再改价
- 前端：OrderDetail 行金额输入 + 确认/取消；i18n `order.manualQuote` 等
- 边界：无支付/webhook；无平台客服后台；权限仍为 org 成员

## P6.2 主要新增

- 后端：`apps/orders`（`Cart`/`CartItem`/`Order`/`OrderItem`）；`GET/POST cart`、`POST/GET orders`；`Idempotency-Key` 下单
- 规则：金额只来自 Quote 快照；任一行非 `valid` → 订单 `pending_manual` + `total_amount=null`；全部 valid → `quoted` 汇总；忽略客户端金额；`payment_mode=manual_quote`
- 前端：`api/cart|orders` + stores；`CartPage`/`OrdersPage`/`OrderDetailPage`；DesignEditor「加入购物车」；i18n `cart.*`/`order.*`
- 边界：无支付/webhook；不在 Cart/Order 层重算或伪造价格

## P6.1 主要新增

- 后端：`apps/quotes`（`PricingRuleVersion` / `Quote`）；`POST/GET /api/v1/quotes/`；`seed_pricing` demo 规则 `is_official=False`
- 规则：无官方规则 → `pending_manual` + `total_amount=null`；有官方规则 → 服务端算价；忽略客户端金额
- 前端：`api/quotes` + `stores/quote`；DesignEditor「获取报价」；i18n `quote.*`
- 边界：无 Cart/Order/Payment；`payment_mode=manual_quote`；未复用 pacdora 快照

## P5.2 主要新增

- 服务端：`_assert_parametric_limits` 在 geometry HTTP 前按 `TemplateVersion.limits` 拦截；`DesignDetail.param_limits`
- 前端：创建页/编辑器 L/W/H `min`/`max`；store 越界不发保存；i18n `studio.outOfRange`
- 边界：未读取 pacdora 快照；`B-GEOM-LICENSE` 保持 Open

## P5.1 主要新增

- seed：`fixed_snapshot` 写入 `param_schema.locked_dims`；parametric `limits` 与 JS 模板同源；可重复执行回填
- 服务端：`apply_server_geometry` 对 `FIXED_SNAPSHOT` 比较 L/W/H（容差 0.01mm）→ 不一致 `400 SIZE_LOCKED`
- 前端：`ProductDetailPage` 创建失败识别 `SIZE_LOCKED`；i18n `studio.sizeLockedError`
- 边界：未读取 `public/shipping-geom` / pacdora 快照；`B-GEOM-LICENSE` 保持 Open

## Infra Compose 主要新增

- 镜像：`NODE_IMAGE` / `PYTHON_IMAGE` / `CADDY_IMAGE` / `POSTGRES_IMAGE` / `REDIS_IMAGE` 可覆盖；backend apt 走阿里云 + 仅 `libpq5`
- geometry：deps 装到 `/app` 根，修复 `polygon-clipping` 解析
- 冒烟：`deploy/scripts/compose-smoke.mjs`；bootstrap 含 seed_catalog / Windows 排障
- Celery：`redis>=6.1` 满足 kombu

## P3.3 主要新增

- 改尺：`artworkResize.mjs` 三策略；store 有图层时可改 L/W/H；Selection 可设 policy/anchor
- 3D：`artworkBake` CanvasTexture；`knifeScene.setArtworkMaps`；`StudioFoldPreview` + 顶栏 2D/3D
- 测试：`scripts/check-artwork-resize.mjs`；浏览器改尺/折叠 Passed

## P3.2 主要新增

- Schema：`text`/`shape`/`crop` 收紧；后端 `document.py` 按 kind 语义校验 → `VALIDATION_ERROR`
- Store：`addTextLayer` / `addShapeLayer` / `setCrop`；有图层仍禁改尺
- 画布：`StudioCanvas2D` 渲染 text/rect/ellipse + crop image；`clip=panel` 用 Konva clipFunc
- UI：`ToolRail`、`TextToolPanel`、`ElementsPanelPanel`、`SelectionPanel`；左侧工具轨内容区
- 离线：`draftRepository` IndexedDB；加载时 recover / server_newer 冲突提示
- 测试：`test_text_shape_crop_revision`；浏览器复开与草稿恢复 Passed

## P4 首片主要新增

- 后端：`apps/ai_jobs`（AiJob / UsageReservation / UsageLedger、capabilities、Celery tasks、providers disabled/test/openai/gemini）
- API：`/ai/capabilities/`、`designs/{id}/ai-jobs/`、`ai-jobs/{id}/` cancel/apply、`generated-assets/`
- 前端：`AiPanel.vue`、`api/ai.ts`、`stores/ai.ts`；默认 disabled 禁用生成
- 测试：`tests.test_ai_jobs` 6/6；Gemini live 冒烟 Passed（`B-AI-KEY` Resolved）

## P3 首片主要新增

- 依赖：`konva`、`vue-konva`
- Studio：`src/studio/*`、`src/components/studio/StudioCanvas2D.vue`、`LayersPanel.vue`
- 编辑器：`DesignEditorPage` 左图层/中画布/右参数；document 级撤销重做；有图层禁改尺
- P2 冒烟修复：开发 CSRF 信任源含 `http://127.0.0.1:5173`

## P2 主要新增

- Schema：`packages/design-schema/design-document.v1.schema.json`、`designDocument.ts`
- 后端：`apps/catalog`、`apps/assets`、`apps/designs`（模型/Admin/API/seed_catalog）
- 前端：`/products`、`/products/:slug`、`/designs`、`/designs/:id`；`stores/design.ts`；`Idempotency-Key` 客户端
- 测试：`backend/tests/test_assets_designs.py`（上传/复开/409/幂等/跨组织/asset 门禁）

## P1 主要新增

- 前端：`src/legacy/LegacyLab.vue`、`src/router/`、`src/pages/*`、`src/api/client.ts`、`src/stores/auth.ts`
- 后端：`backend/`（accounts / organizations / health / geometry_api）
- 几何：`services/geometry/`
- 部署：`deploy/compose.yaml`、`Dockerfile.caddy|backend|geometry`、`Caddyfile`、`env.example`、`scripts/bootstrap.md`
