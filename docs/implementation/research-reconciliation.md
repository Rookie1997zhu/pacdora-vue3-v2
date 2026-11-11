# Research Reconciliation — BOXCRAFT × Packative

**日期**：2026-11-10  
**仓库根**：`pacdora-vue3-v2/`（内层 git 根）  
**HEAD**：`59ae1f8637f19cc655562bb2029fcb4fddcccd7f`  
**约定**：事实 / 研究作者记录 / 推断 / 独立设计 / 待验证 分列；未看见的视觉细节不编造为已测量。

## 1. 事实（本地源码与目录）

| 项 | 证据 |
|----|------|
| 栈 | Vue 3 + JavaScript + Vite + Three.js + vue-i18n + pdf-lib；`package.json` 无 Router/Pinia/Konva/TypeScript |
| 主 UI | `src/App.vue`（~1215 行），`screen=gallery\|lab` |
| 几何 | `src/knife.js`、`src/templates/`、`src/knifeContract.js` |
| 外箱 | `src/outbox.js`、`src/lab/knifeScene.js` |
| 导出 | `src/exportDieline.js`：SVG/DXF/PDF/AI；`DEMO · NOT FOR DIE CUTTING`；`manufacturingReady=false` |
| PDF 尺度 | `toPdf()` 用 `wMm+margin` 作为页尺寸，**无**显式 `mm * 72 / 25.4` |
| 出血 | `BLEED_EXTRA_MM=10`（`src/knife.js`） |
| 目录 | `src/catalog/presets.js`：`count=47`，`byCategory.shipping=47`，稳定 ID `import-*` |
| geomMode | `hasGeometry && sourceNum` 时走 `loadPacdoraGeomKnife`，尺寸控件锁定 |
| README 文案 | 写「只导入尺寸与元数据」；与 `geomMode` 加载几何快照的代码路径并存 |
| 后端 | P1 已新建 `backend/`（非 PackFlow 复用） |
| 部署 | P1 已落地 `deploy/`；方案包样板仍可对照 |
| 研究 08/09 | 描述 `global-toolbox-vue3`、Django apps、`engine-ts` — **不在本仓** |
| Pages | `.github/workflows/deploy-pages.yml` 存在；`GITHUB_PAGES=1` 时 `base=/pacdora-vue3-v2/` |
| 未跟踪 | `BOXCRAFT_Fullstack_Implementation_Package_2026-11-10/`、部分 `public/materials/` |

## 2. 研究作者记录（黑盒观察，非本仓实现）

见 `docs/packative-research/` README 与 01–10：Studio 工具栏、AI 双模式、保存复开、购物车、EPS 刀版、EngView 3D 等。研究作者的 Passed **不等于** BOXCRAFT 已实现。

## 3. 推断

- Packative 营销站 Next.js + Supabase/Medusa 双轨；本项目不复制该栈。
- 对方印前 CMYK/分层 PDF 对本账号多为 Partial/Blocked；不可当作已验证成品规格。
- 展开尺寸与 L/W/H 有近似关系，但 **未反推出完整内部公式**。

## 4. 独立设计（本方案）

- Vue3 保留 + 新模块 TS；Django DRF + PostgreSQL；Redis/Celery；Node 几何服务共用 JS 核心；Caddy 托管 dist，无 frontend 运行容器。
- LegacyLab 保全于 `/lab`；过渡期 `/` 仍旧站；新首页 `/home`；Session + CSRF。
- DesignDocument 为权威 JSON；不把 Konva/Three 对象树当唯一真源。
- 报价无正式规则时显示待报价，不返回假价；支付默认 `manual_quote`。

## 5. 待验证

| 项 | 状态 |
|----|------|
| P0：`npm run build` / `check:all` 退出码 | 见 `test-evidence.md` |
| 截图色值/精确间距 | 未量测；见 `ui-reference-manifest.json` |
| 几何快照商业复用权 | 需授权登记，不默认获得 |
| Compose 本机 Docker | P1 冒烟时填写 |
| AI 供应商实调 | 无 key 时 Blocked |
| SMTP 密码重置投递 | 未配置时 Blocked |

## 6. 错位清单（开发前必读）

- **F-01**：研究 08/09 PackFlow 后端 ≠ 本仓。
- **F-02**：README「仅尺寸」vs `geomMode` 加载 `shipping-geom`/geometry 快照。
- **F-03**：旧 PDF 非明确 1:1 mm 链。
- **F-04**：`productionReady=validation.ok` ≠ `manufacturingReady`。
- **F-05**：样机 / 固定快照 / 参数模板三种能力分开。
- **F-06**：无云端设计持久化；localStorage 语言偏好 ≠ 云保存。
