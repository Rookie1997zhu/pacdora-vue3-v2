# BOXCRAFT Packative / 刀版相关 — 落地决策

日期：2026-11-12  
状态：**V1.2 现行**（主线 = Packative → Lab；固定原件库 = 旁路）

依据：[V1.2 方案](../packative-research/BOXCRAFT_Complete_Plan_Fresh_20261112/boxcraft_dieline_library_plan_v1_1/BOXCRAFT_Packative_Lab_Catalog_Plan_V1.2_2026-11-12.md)

## 项目边界

| 项 | 决策 |
|---|---|
| 实施对象 | 本地 BOXCRAFT（`Rookie1997zhu/pacdora-vue3-v2`） |
| PackFlow | 本轮不接入、不同步、不共享运行资源 |
| 研究 lab | 只读复用允许证据；不改原始证据文件；**生产接线另任务** |
| Git | 不自动 clone/pull/commit/push/deploy |

## 主线 vs 旁路（V1.2）

| 路径 | 决策 |
|---|---|
| **主线** | Packative 参数/几何目录 → Lab「Packative」源（对齐 Pacdora `presets` + geom） |
| 首盒型 | `productbox-crashlock`（复用 `research/packative-dieline-lab`） |
| Lab UX | 与「已有刀版 / Pacdora 导入」并列；改尺寸仅已验证范围；无拓扑不虚构 3D |
| presets / catalog | **允许** Packative **尺寸/geom 目录**条目，须标明验证状态；**禁止**把目录条目标成「原件已入库」 |
| knife / 自研 templates | **禁止**未验证第三方切压线直接注入冒充自有引擎 |
| **旁路** | `backend/apps/dieline_library/` + `/library/dielines`：固定 SVG 归档 / 2D 预览 / 权限下载 |

## 旁路模块与路径（已交付，非主成功标准）

| 项 | 决策 |
|---|---|
| 后端应用 | `backend/apps/dieline_library/` |
| 前端功能 | `src/features/dieline-library/`；路由 `/library/dielines` |
| API 前缀 | `/api/v1/dieline-library/...`（兜底前挂载） |
| 文件存储 | 复用 `apps.assets.Asset` |
| 采集 | REA 契约 + Scrapy/direct CDN；`authorized_api`；CLI `--live`；无默认 Beat |

## 领域模型（旁路固定资产）

- `DielineFamily` / `SourceProvider` / `SourceTemplate` / `AssetVariant` / `ImmutableRevision` / `UsageGrant`
- 三状态轴：`acquisition_status` / `rights_status` / `manufacturing_status`（互不自动升级）

## 采集工具链

| 项 | 决策 |
|---|---|
| REA | 观察入口/字段/样本路径，支撑**参数矩阵**（主）与可选归档（旁） |
| Scrapy / 运行时 | 多样本拉取；旁路可 `import_local_manifest` |
| Packative 许可 | 默认 enabled + perpetual；显式 disabled 仅门禁测试 |
| paid_actions | false |

## 计数与验收口径（V1.2）

- **主指标**：Lab 可选 Packative、验证规格可改尺寸且与样本门槛一致、证据可追溯  
- **次指标**：旁路可下载固定资产数（example 不计；真网不编造）  
- `productionReady` ≠ `manufacturingReady`

## 历史说明

Cursor phase1–4 与 `packative_online_runtime` 执行 plan 对应 **V1.1 固定库**；已被 V1.2 主线取代。旁路代码保留复用。
