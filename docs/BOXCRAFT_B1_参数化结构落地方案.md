# BOXCRAFT LAB · B1 参数化结构落地方案

> 版本：2026-10-29（修订）  
> 适用：网站项目（`http://localhost:5173/` · BOXCRAFT LAB）为主；爬虫仓 / Pacdora 数据为只读参考。  
> 目标：导入尺寸目录用**自有模板重算**刀版与 3D，不加载第三方刀版坐标。

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-10-29 | 初稿：B1 参数化、分阶段、两周排期 |
| 2026-10-29 | **现状校准**：P0–P2 模板已落地；阶段 0/1 大半完成；API 统一为 `layout`+`createKnife`；阶段 2 改为按 `structureCode` 族增量；可映射挂载走 `sourceNum→templateId` 覆盖表 |

---

## 0. 现状对照（相对初稿）

| 项 | 状态 |
|----|------|
| 自研模板 | 约 **18** 个（含 P0–P2 及示意级：磁吸/PDQ/多边形等） |
| 尺寸目录 | 约 **1260/1722** 已映射（可映射 70 + KnifeDraw 等改判） |
| 未映射标注 | [`未映射名单/`](../未映射名单/)：可映射 ~70 / 需新模板 ~460 / 仅尺寸 ~40 |
| 生成 API | `template.layout` + [`src/knife.js`](../src/knife.js) `createKnife`（**不是**文案里的 `generate()`） |
| 本仓几何 | [`geometry/pacdora_boxes/`](../geometry/pacdora_boxes/)（开发机参考，运行时不播） |
| 映射覆盖表 | [`src/catalog/mapOverrides.json`](../src/catalog/mapOverrides.json)（`catalog:build` 优先读取） |

**结论：** 初稿阶段 2 的「从零补 P0–P2」已过时；当前主线是 **挂可映射 + 按 code 族补缺口**。

---

## 1. 结论（先看这里）

| 问题 | 决策 |
|------|------|
| 现在写网站还是继续采数据？ | **以网站写码为主**；采集已够用，停止以采集为主线 |
| 几何怎么来？ | **B1：自研参数化模板**（改 L/W/H → `layout` → `createKnife`） |
| Pacdora JSON 干什么？ | **离线量级抽检 / 反推参考**，运行时不播路径点；**不要求折线重合** |
| FEFCO / ECMA PDF 干什么？ | **代号标签与检索**，不抽成刀版几何 |
| 开放「结构新模板 JSON」有没有？ | **没有**；Open API 主要是 PDF/AI/DXF 导出 |

产品侧已写明：

> 选中后用自有模板重算，不加载第三方刀版坐标。

---

## 2. 背景与边界

### 2.1 参考数据（只读）

| 产物 | 网站仓常见路径 | 爬虫仓（若分离） |
|------|----------------|------------------|
| 盒子列表 CSV | `pacdora_boxes_geom.csv` | `exports/pacdora_boxes*.csv` |
| 刀版几何 JSON | `geometry/pacdora_boxes/{num}.json` | `exports/geometry/pacdora_boxes/` |
| 结构清单 | `structure_inventory/` | `exports/structure_inventory/` |
| 未映射标注 | `未映射名单/` | handoff 导出 |

### 2.2 网站已具备（BOXCRAFT LAB）

- 分类：**已有的刀版** / **导入的尺寸目录**（约 1722 条）
- 自研示意：翻盖邮寄、飞机盒、STE/RTE、开窗/挂孔/拉链、FEFCO 0201/0427、锁底、提手、天地盖、袖套、抽屉、食品翻盖、磁吸示意、PDQ、多边形等
- 参数：内/外尺寸、L/W/H、厚度、出血、瓦楞；部分模板 `piece`
- 导出：Knife JSON、DXF、PDF、SVG
- 契约：`productionReady` / `manufacturingReady=false`（校样级）

### 2.3 明确不做

1. 运行时加载 Pacdora `cuts/folds` 到预览  
2. 从 FEFCO/ECMA PDF「自动提取」参数化几何  
3. 再全量爬 Pacdora  
4. 把 DXF/PDF 校样当开模文件  
5. 为「需新模板」460 条逐条做独立生产模板  

---

## 3. 总体架构

```text
┌─────────────────────────────────────┐
│  参考数据（CSV / geometry / 未映射名单） │
│  只读：编号 + 尺寸 + 结构线索            │
└──────────────┬──────────────────────┘
               │ mapOverrides + mapTemplate
               ▼
┌─────────────────────────────────────┐
│  BOXCRAFT LAB                         │
│  layout() → createKnife()             │
│  导入尺寸 → 自有模板重算 → 导出 Knife   │
└─────────────────────────────────────┘
               │
               ▼
         FEFCO/ECMA 仅作 stdCode 标签
```

**数据流：** 第三方只提供「编号 + 尺寸 + 结构参考」；几何一律由自有引擎生成。

---

## 4. 分阶段计划（校准后）

### 阶段 0 · 交接准备 — **大半完成**

- [x] `suggestAction`：可映射 / 需新模板 / 仅尺寸（见 `未映射名单/`）  
- [x] 本仓几何与尺寸 CSV 可用  
- [ ] `suggestedTemplateId` 由覆盖表脚本维护（见阶段 1）

### 阶段 1 · 可映射挂载 — **进行中 / 本波重点**

目标：标注为 **可映射** 的条目挂到**现有** `templateId`。

任务：

1. `templateId` ↔ 侧栏分组已存在于 `src/catalog/index.js`  
2. 生成 `sourceNum → templateId` 覆盖表（优先于关键词）  
3. `catalog:build` → 选中导入尺寸 → 自有模板重算  
4. 挂不上的保持未映射或改判，进入阶段 2 backlog  

验收：

- [ ] 「可映射」条目绝大多数有 `templateId`  
- [ ] 预览来自自有生成器，非第三方 JSON  
- [ ] `npm run check:all` 绿  

### 阶段 2 · 按 structureCode 族增量 — **取代「从零 P0–P2」**

P0–P2 几何示意**已落地**。本阶段只对「需新模板」按 **code 族**处理：

| 建议动作 | 含义 |
|----------|------|
| 改判可映射 | 可借用现有模板，写入覆盖表 |
| 新模板 | 公开结构 + 可矩形化后，写一个族级 `layout` |
| 仅尺寸 | 塑料/圆柱/超引擎，不挂模板 |

单个**新**模板工作流（仅对选定族）：

1. 选 1～3 个代表 `num`，离线看 JSON 量级（面数/展开，不拷贝坐标）  
2. 用公开结构或实物定拓扑 → `layout` + `closedCheck`  
3. 注册、`check:templates` / `check:fold`  
4. 覆盖表消化同族尺寸  

验收：自有 `check:all` 为主；Pacdora 仅可选量级抽检。

### 阶段 3 · 标准代号目录（可选）

- FEFCO/ECMA → `stdRefs[]` 标签；**不**作为 `createKnife` 输入  

### 阶段 4 · 契约升级（中后期）

- 打样前不拉高 `manufacturingReady`  
- 校样导出与开模权限分离（若需要）  

---

## 5. 职责分工

| 侧 | 做什么 | 不做什么 |
|----|--------|----------|
| **网站 BOXCRAFT** | 模板、`mapTemplate`/覆盖表、导入 UX、导出、契约 | 再爬 Pacdora |
| **参考数据 / webspider** | 只读；handoff / 未映射标注 | 运行时供刀版坐标 |
| **国际标准 PDF** | 代号表 | 当几何源 |

---

## 6. 风险与原则

1. **示意 ≠ 开模**  
2. **合规**：Pacdora 仅内部参考；不二次分发原始 knife  
3. **多图层硬盒**：示意即可，不承诺逐点一致  
4. **映射质量**：宁可未映射也不要错挂  

---

## 7. 近期排期（校准）

| 天 | 事项 |
|----|------|
| D1 | 修订本方案；生成可映射覆盖表 |
| D2 | `catalog:build` + 抽检可映射挂载；`check:all` |
| D3 | `structureCode` backlog；明显改判写入覆盖表 |

（原「D4–D8 补 P0」取消：P0–P2 已有模板。）

---

## 8. 成功标准（当前 MVP）

1. 标注 **可映射** 的条目选中后走自有模板重算。  
2. P0–P2 侧栏可切换、可导出 Knife JSON（已满足，保持回归绿）。  
3. 口径一致：新模板来自自研 `layout`/`createKnife`；Pacdora / 标准 PDF 定位如上。  
4. 不以「继续全量采集」为阻塞项。  
5. 产出 code 族 backlog，供下一波单开实现。  

---

## 9. 参考路径

- 网站：`http://localhost:5173/`  
- 模板：`src/templates/` · 引擎：`src/knife.js`  
- 目录构建：`scripts/build-presets-from-csv.mjs` · 覆盖表：`src/catalog/mapOverrides.js`  
- 未映射：`未映射名单/` · backlog：`未映射名单/10_structureCode_backlog.md`  
- FEFCO：[FEFCO Code](https://www.fefco.org/technical-information/fefco-code)  

---

## 10. 执行入口（本波）

1. 跑 `node scripts/build-map-overrides-from-unmapped.mjs` 生成覆盖表。  
2. `npm run catalog:build` && `npm run check:all`。  
3. 查阅 `未映射名单/10_structureCode_backlog.md` 决定下一族新模板。
