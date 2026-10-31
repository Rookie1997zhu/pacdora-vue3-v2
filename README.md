# BOXCRAFT LAB V3

Vue 3 + Vite + Three.js 参数化翻盖邮寄盒概念验证。

## 启动

```bash
npm install
npm run dev
```

自检：

```bash
npm run check:topology
npm run check:fold
npm run check:contract
npm run check:export
npm run check:golden
npm run check:all
```

## 核心设计

`src/knife.js` 是唯一几何数据源，生成 `faces`、`cuts`、`folds`、`hinges`、`layers`、`animation`、`sizeArrowData`。Vue SVG 与 Three.js 读取相同数据。尺寸改变时重新生成数据和模型。3D 折叠按 parent/child 铰链变换，滑块直接控制角度。

当前为 **19 面概念拓扑**（`base` 为根），schema `boxcraft.knife.v3`。

### 厚度与合盖（P2）

- 默认 **内尺寸** 输入；也可切到外尺寸。`dimensions` 同时给出 `inner` / `outer` / `panel`。
- 3D 铰链落在板厚 **中性层**（挤出后平移 `-T/2`）。
- 瓦楞方向 `fluteDirection`（L/W）写入数据与 UI，暂不改切压算法。
- 合盖检测为闭合态 **AABB 示意**（模板 `closedCheck` + `src/foldSim.js`），覆盖全部已注册盒型；不是生产级干涉引擎。

### 数据契约（P3）

- `src/knifeContract.js`：`FACE_ORDER`（19 稳定面名）、`validateKnife`、`assertStableTopology`。
- 改 L/W/H/T 只变坐标，`name` / `parent` / `side` 不变。
- 导出含 `layers.trim|crease|bleed`（由 cuts/folds/bleeds 投影）、`material`、`validation`。
- **`productionReady`** = `validation.ok`（拓扑与数值完整性门禁；合盖告警记入 checks 但不单独锁死默认尺寸）。
- **`manufacturingReady`** 恒为 `false`：**不可开模**；勿把 `productionReady` 当作可投产信号。

### 导出 DXF / PDF（P4）

- `src/exportDieline.js` 只消费 `layers.trim|crease|bleed`（不从 DOM SVG 反推）。
- **DXF**（ASCII R12）：图层 `TRIM` / `CREASE` / `BLEED`，单位 mm；刀版 Y 向下 → CAD Y 向上（原点取 bounds 左下）。
- **PDF**：矢量校样 + 页眉尺寸/材质 + 免责声明 `DEMO · NOT FOR DIE CUTTING`（标准字体不含汉字；中文说明见 SVG 注释）。
- **SVG 下载**同样走 `toSvgDieline`（与画布预览解耦）。
- `manufacturingReady` 仍为 `false`；导出不表示可开模。

### 验证闭环（P5）

- 黄金样例：`scripts/fixtures/golden.json`（default / min / large）；`npm run check:golden` 断言拓扑稳定、契约与 DXF 图层。
- 一键门禁：`npm run check:all`（topology → fold → contract → export → golden → templates）。
- 实物打样对照模板：[docs/SAMPLE_CHECKLIST.md](docs/SAMPLE_CHECKLIST.md)（当前**未打样**）。
- **未完成实物打样前禁止投产**；`manufacturingReady` 保持 `false`。

### 参数化模板引擎（P6）

- `src/templates/`：每个盒型一个模板文件，只描述面板矩形布局（`layout`）、面序（`faceOrder`）、根面、尺寸范围和厚度补偿规则；`src/knife.js` 统一生成裁切、压线、出血、铰链和校验。
- 现有模板：`mailer-parametric-demo`、`fefco-0427`、`mailer-aircraft`、`fefco-0201`、`tuck-end-straight` / `reverse`、`tuck-window`、`hanging-tuck`、`zipper-tuck`、`auto-lock-bottom`、`handle-box`、`lid-base`（底/天 `piece`）、`sleeve` / `drawer-tray`、`pizza-clamshell`、`magnetic-rigid`、`display-pdq`、`polygon-tray`。开窗/挂孔/拉链齿走 layout `holes` 内环裁切。
- 厚度补偿 `sizeRule`：`panel = inner + panelAdd·T`，`outer = inner + outerAdd·T`；外尺寸输入先反推净空，再按模板 `limits` 夹取。系数为示意值，需打样校准。
- 压线 = 相邻面完整共享边 ∪ 铰链处部分重叠边；出血 = 各面片外扩后求并集（窄槽口自动填平）。
- 新增盒型：在 `src/templates/` 写一个模板并在 `index.js` 注册，再跑 `npm run check:templates`（每个模板 default/min/max 三组尺寸 + 内外尺寸互推 + 每条铰链都有压线）。
- 合盖检测：各模板在 `closedCheck` 中声明闭合态 AABB 与配对；`foldSim.estimateClosedCollisions` 通用求值（重叠=通过，分离>`T*2`=告警）。仍为示意检测，非物理干涉。

### 盒子分类与导入尺寸目录

- 界面：`盒子 → 已有的刀版` + `导入的尺寸目录`。
- **已有的刀版**按结构分组：翻盖邮寄 / 插舌盒 / 开槽纸箱 / 锁底盒。
- **导入的尺寸目录**按业务分类筛选：礼品盒 / 展示盒 / 运输箱（来自 CSV「分类」字段）；支持搜索编号与名称。
- 数据：`pacdora_boxes_geom.csv` + `geometry/pacdora_boxes/*.json` 索引 → `npm run catalog:build` → [`src/catalog/presets.js`](src/catalog/presets.js)。
- **只导入尺寸与元数据**；选中后仍由 BOXCRAFT 模板重算刀版。不把第三方 `cuts/folds` 坐标接入引擎，也不作为可开模资产。
- `geometry/pacdora_boxes/*.json` 已写入 `.gitignore`，避免把第三方几何快照提交为产品数据。

### 结构清单（补模板用）

- 原始表：[`structure_inventory/`](structure_inventory/)（01–06 CSV/XLSX）。
- 整理摘要与优先级：[`structure_inventory/00_整理摘要.md`](structure_inventory/00_整理摘要.md)、[`structure_inventory/priority_templates.json`](structure_inventory/priority_templates.json)。
- 重建整理：`node scripts/organize-structure-inventory.mjs`。

## 重要限制

- 本项目独立实现概念几何，不包含 Pacdora 私有刀版数据或服务端算法。
- 19 面翻盖邮寄盒为自研概念拓扑；FEFCO 0201 与插舌盒按公开结构自行实现，均非生产开模数据。
- 出血线为各面片外扩后的并集轮廓。
- **导出 SVG / JSON / DXF / PDF 不可直接用于生产、开模或打样。**
- **软件自检通过 ≠ 可开模；须完成实物打样对照后方可另行评审。**

## 后续

按 [docs/SAMPLE_CHECKLIST.md](docs/SAMPLE_CHECKLIST.md) 完成打样与补偿回写；补齐授权结构规范与真实折叠/工艺参数。
