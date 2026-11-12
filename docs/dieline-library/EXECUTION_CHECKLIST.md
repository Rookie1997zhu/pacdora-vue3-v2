# BOXCRAFT Packative / 刀版 — 执行清单（V1.2）

勾选表示该步已在本仓库完成。  
**现行主线 = Packative REA → Lab**；下列「V1.1 旁路」为历史已完成，不替代主线。

## V1.2 主线

### P0 — 方案切换

- [x] V1.2 方案正文与 prompts 00–04
- [x] 本目录 DECISIONS / GAP / README / ACCEPTANCE 口径更新
- [x] 标注 V1.1 与旧 Cursor phase plans 为历史/旁路

### P1 — REA / 目录证据

- [x] REA 复核 Packative 入口与字段（crashlock 优先；韩语站）→ `research/packative-dieline-lab/reports/p1-rea-ko-session.md`
- [x] 规格矩阵与样本盘点（validated 本地已齐；未强制补拉 optional missing）→ `reports/p1-sample-inventory.*`
- [x] 产出 Pacdora 同构目录草案 → [`docs/packative_lab_catalog/`](../packative_lab_catalog/)

### P2 — Lab 接线

- [x] Lab 第三源「Packative」（与 owned / Pacdora imported 并列）→ `LegacyLab` + `src/packative/`
- [x] crashlock：验证范围内改尺寸 → 原型/geom 回放（`generateCrashlockWithOutline`）
- [x] 未验证尺寸提示；禁止静默拉伸；holdout 只读对照
- [x] i18n；无拓扑不虚构 3D（仅 2D SVG）

### P3 — 验收与扩展

- [x] 按 V1.2 `03` 提示词验收 Lab Packative → [`reports/p3-lab-acceptance.md`](../../research/packative-dieline-lab/reports/p3-lab-acceptance.md)
- [x] holdout/gates 对比报告 → [`reports/p3-holdout-gates.md`](../../research/packative-dieline-lab/reports/p3-holdout-gates.md) / `.json`
- [x] 再扩其它盒型（首批）→ **mailerbox** 2 规格 + **pillowbox** 1 规格官方 SVG 2D；见 [`packative-mailerbox-2d.md`](../../research/packative-dieline-lab/reports/packative-mailerbox-2d.md)、[`packative-pillowbox-2d.md`](../../research/packative-dieline-lab/reports/packative-pillowbox-2d.md)（运输箱产品目录导入另线推进，本清单不涵盖）
- [x] 再扩 **sleeve** 2D → CDN 12 尺寸全 403，交付 **blocked** 探测结论；未改 catalog/public；见 [`packative-sleeve-2d.md`](../../research/packative-dieline-lab/reports/packative-sleeve-2d.md)
- [x] 旁路归档同批 SVG（可选）→ `npm run publish:packative-geom` + `import_dieline_manifest`；见 [`packative-publish-bypass.md`](../../research/packative-dieline-lab/reports/packative-publish-bypass.md)
- [x] Packative 3D Phase 0（EngView 证据 → 映射裁决）→ **`mesh_only`**；见 [`packative-3d-map-verdict.md`](../../research/packative-dieline-lab/reports/packative-3d-map-verdict.md)（未接 Lab geomRig）
- [x] 2D harden：`npm run verify:packative-geom` + dist 10 SVG 抽查 → [`packative-2d-harden.md`](../../research/packative-dieline-lab/reports/packative-2d-harden.md)

## V1.1 旁路（历史已完成）

### Phase 0–4 固定原件库

- [x] `dieline_library` 后端 MVP、安全预览、权限下载
- [x] `/library/dielines` UI
- [x] SourceAdapter + Packative CDN 运行时 + `--live` + mock 测试
- [x] Phase 4 旁路验收：**可内部试用**（固定库框架）；见当时 [ACCEPTANCE.md](./ACCEPTANCE.md)

详见 V1.2 ACCEPTANCE 中「旁路 vs 主线」说明。
