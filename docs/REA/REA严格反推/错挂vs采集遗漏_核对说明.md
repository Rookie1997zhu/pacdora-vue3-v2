# 错挂 vs 采集遗漏 · 核对说明

> 日期：2026-10-29  
> 对照：`http://localhost:5173/` 导入尺寸目录 ↔ Pacdora.cn box-mockups ↔ 本地 `geometry/pacdora_boxes`  
> 网站仓：`pacdora-vue3-v2`（Downloads）

---

## 1. 一句话结论

**「没有盖子 / 结构不完整」主因是模板错挂（把有盖复杂结构挂成开顶示意），不是 Pacdora 刀版没采到。**

采集侧有少量官方 count 差与「爬虫 2033 vs Demo 1802」筛选差，**解释不了**大批开顶/残缺观感。

---

## 2. 铁证样例：`100022`

| 层 | 事实 |
|----|------|
| Pacdora 几何 | `PairWithWindowHookLock`，19 面 / 19 折 / 104 切 |
| 修复前 Demo | `templateId=display-pdq` → UI「开顶托盘」，详情约 **5 面 · 4 折** |
| 修复后 Demo | `structureCode` 回填 + `rea-pair-window`（`templateSource=structure-code`） |

几何文件一直在；运行时按 B1 **不播** Pacdora cuts，只跑自研 `generate()`，错模板就会「没盖子」。

---

## 3. 根因链

```text
Pacdora 有盖金样（已采）
  → presets 有 foldCount/geomRel，但缺 structureCode / 关键词含 display
  → 挂到 display-pdq / drawer-tray 等开顶模板
  → EXPECTED.window 曾包含 display-pdq，纠错跳过
  → UI 徽章「开顶*」+ 面数远少于金样 → 「结构不完整」
```

---

## 4. 已做修复（网站仓）

1. **审计 CSV**：`未映射名单/13_开顶且折线ge12.csv`、`14_缺structureCode.csv`  
2. **回填** `structureCode`（1722 条从几何 JSON）  
3. **扩展** `structureCodeTemplates`（`PairWithWindowHookLock` 等 + Hook/Window/Aircraft/Cover 启发 + `--prefixes`）  
4. **收紧** `EXPECTED`：`window` / `hanging` 等去掉 `display-pdq` 白名单  
5. **重挂** `remap-open-top-highfold.mjs`  

量化（约）：

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 缺 `structureCode` | ~1722 | **0** |
| 开顶且 foldCount≥12 | **153** | **~100**（多为真托盘 `KnifeDraw`/`Tray*`） |
| `100022` | display-pdq | **rea-pair-window** |
| 已映射条数 | ~1346 | **~1484** |

残留开顶高折线以真实托盘/抽屉为主，不宜再强行改成插舌。

---

## 5. 采集缺口（次要）

| 来源 | 结论 |
|------|------|
| `01_官方子类命中统计.csv` | 多数子类宣称−命中差 **0～3** |
| 爬虫 CSV 2033 vs Demo 1802 | 差约 **231**：几何仍在（`geomMissing=0`），是**未进导入目录**，不是刀版丢失 |
| 塑料盒 UI 14 vs 站点 63 | 多为 `CanCylinder`→仅尺寸/平板分流 |

产物：`pacdora-vue3-v2/未映射名单/16_官方子类count差集.*`、`15_目录条数差.md`。

补漏建议：只对 gap 子类分页差分补 `num`；Demo 若要对齐 2033，重跑 `build-presets-from-csv` 后再走 structureCode / 开顶重挂流水线——**不必为盖子问题全量重爬**。

---

## 6. 与 B1 的关系

见 [BOXCRAFT_B1_参数化结构落地方案.md](./BOXCRAFT_B1_参数化结构落地方案.md)：导入尺寸 → **自有模板重算**。  
因此映射质量 = 产品观感；Pacdora JSON 只作反推与审计，不是运行时刀版源。

复跑命令（网站仓）：

```bash
node scripts/audit-open-top-mismap.mjs
node scripts/backfill-structure-codes.mjs
node scripts/apply-structure-code-templates.mjs --prefixes
node scripts/correct-subclass-templates.mjs
node scripts/remap-open-top-highfold.mjs
node scripts/export-official-count-gaps.mjs
```
