# BOXCRAFT LAB · B1 参数化结构落地方案

> 版本：2026-10-29（rev6）  
> 适用：网站项目（`http://localhost:5173/` · BOXCRAFT LAB）为主；本爬虫仓（webspider / Pacdora 数据）为参考数据源。  
> 目标：导入尺寸目录用**自有模板重算**刀版与 3D，不加载第三方刀版坐标。

### 变更记录

| 日期 | 变更 |
|------|------|
| 2026-10-29 | 初版：B1 路线、阶段、职责 |
| 2026-10-29 rev2 | 新增 §11：Pacdora.cn 17 官方子类 openParams/面片反推汇总 + 主结构公式 |
| 2026-10-29 rev3 | REA 严格路径：证明 Aircraft 公式在服务端；受控 knife 差分五组全过 → [REA_Aircraft_严格反推记录.md](./REA_Aircraft_严格反推记录.md) |
| 2026-10-29 rev4 | **17 类同级严格 REA**：列表 id 差分网格 + 闭合公式总表 → [REA_17cats_严格反推记录.md](./REA_17cats_严格反推记录.md) |
| 2026-10-29 rev5 | 反推补充：开窗闭合、Aircraft 薄卡分支、CanCylinder/KnifePrototype 负结论、CurveBox 入口专文 |
| 2026-10-29 rev6 | 核实 Demo「没盖子/结构不完整」：主因模板错挂非漏采 → [错挂vs采集遗漏_核对说明.md](./错挂vs采集遗漏_核对说明.md) |

---

## 1. 结论（先看这里）

| 问题 | 决策 |
|------|------|
| 现在写网站还是继续采数据？ | **以网站写码为主**；爬虫仓采集已够用，停止以采集为主线 |
| 几何怎么来？ | **B1：自研参数化模板**（改 L/W/H → `generate()`） |
| Pacdora JSON 干什么？ | **离线反推公式与验收对照**，运行时不播路径点 |
| FEFCO / ECMA PDF 干什么？ | **代号标签与检索**，不抽成刀版几何 |
| 开放「结构新模板 JSON」有没有？ | **没有**；Open API 主要是 PDF/AI/DXF 导出 |

产品侧已写明：

> 选中后用自有模板重算，不加载第三方刀版坐标。

---

## 2. 背景与边界

### 2.1 已具备（本仓 webspider）

| 产物 | 路径（相对 `data search/data_search/`） |
|------|----------------------------------------|
| 盒子列表 | `exports/pacdora_boxes.csv` / `pacdora_boxes_geom.csv` |
| 刀版几何 JSON | `exports/geometry/pacdora_boxes/{num}.json` |
| 刀版预览图 | `exports/images/pacdora_boxes/full/{num}.png\|.svg` |
| 结构清单 | `exports/structure_inventory/01`～`06_*` |
| 采集技能 | `.cursor/skills/pacdora-dieline-crawl/` |

### 2.2 网站已具备（BOXCRAFT LAB）

- 分类切换：**已有的刀版** / **导入的尺寸目录**（约 1722 条）
- 自研示意结构：翻盖邮寄盒、飞机盒、STE/RTE、开窗/挂孔/拉链、FEFCO 0201/0427、锁底、天地盖、袖套、抽屉等
- 参数：内/外尺寸、L/W/H、厚度、出血、瓦楞方向
- 导出：统一 Knife JSON、DXF、PDF、SVG
- 契约示意：`productionReady` / `manufacturingReady`（当前多为校样级）

### 2.3 明确不做

1. 运行时加载 Pacdora `cuts/folds` 坐标到预览  
2. 从 FEFCO/ECMA PDF「自动提取」参数化几何  
3. 为「找公开结构新模板包」再全量爬一轮 Pacdora  
4. 把 DXF/PDF 校样当开模生产文件（`manufacturingReady=false` 阶段）

---

## 3. 总体架构

```text
┌─────────────────────────────────────┐
│  webspider（数据仓 · 只读参考）        │
│  列表 / geometry / 结构清单 / 标注     │
└──────────────┬──────────────────────┘
               │ 导出「尺寸+建议模板」对照表
               │ 离线查阅 {num}.json 反推公式
               ▼
┌─────────────────────────────────────┐
│  BOXCRAFT LAB（网站 · 主开发）         │
│  mapTemplate + 参数模板 generate()   │
│  导入尺寸 → 自有模板重算 → 导出 Knife  │
└─────────────────────────────────────┘
               │
               ▼
         FEFCO/ECMA 仅作 stdCode 标签
```

**数据流一句话：** 第三方只提供「编号 + 尺寸 + 结构参考」；几何一律由自有 `generate(L,W,H,t)` 生成。

---

## 4. 分阶段计划

### 阶段 0 · 交接准备（本仓，0.5～1 天）

可选轻量导出，**不新爬**：

建议字段：

- `num` / 名称 / 品类  
- `L,W,H`（及内外若有）  
- `suggestAction`：`可映射` | `需新模板` | `仅尺寸`  
- `suggestedTemplateId`（可空，网站填）  
- `refGeometryPath`：指向本地 `{num}.json`（仅开发机参考）  
- `stdHint`：如 FEFCO 0201 / STE（可空）

产出示例路径：`exports/handoff/尺寸目录_模板映射底表.csv`

### 阶段 1 · 网站：可映射挂载（优先，约 2～5 天）

目标：1722 条中能挂到**现有**自研模板的，先全部挂上。

任务：

1. 梳理现有 `templateId` 与侧栏结构一一对应表  
2. 扩展 `mapTemplate`（关键词 / 品类 / 编号规则）  
3. 导入底表 → 选中条目 → 用模板重算 → 抽检 2D/3D/合盖  
4. 记录「挂上 / 挂不上」清单，挂不上的进阶段 2

验收：

- [ ] 导入目录选中后尺寸写入参数区并重算成功  
- [ ] 预览路径来自自有生成器，非第三方 JSON  
- [ ] 导出 Knife JSON 字段契约与现网一致  

### 阶段 2 · 网站：B1 新模板（主工程，按结构分期）

对「需新模板」：用 Pacdora 代表样 **离线**反推，写成新参数模板。

#### 单个模板工作流

1. 选 1～3 个同结构代表 `num`，读 `geometry/pacdora_boxes/{num}.json`  
2. 记录默认 L/W/H、`openParams`、面片名、图层  
3. 写面板尺寸公式 → 实现 `generate(L,W,H,thickness,bleed,…)`  
4. 用默认尺寸生成结果与代表样对比（包围盒 / 面数 / 折线数，允许误差）  
5. 注册 `templateId`，侧栏文案可带 `FEFCO xxxx` / `STE` 等标签  
6. 回填映射底表，消化一批导入尺寸  

#### 覆盖优先级（建议）

| 优先级 | 结构方向 | 说明 |
|--------|----------|------|
| P0 | 开槽纸箱 `Carton`、插舌 `Pair` STE/RTE、翻盖邮寄 `Aircraft` | 公式已反推（§11.3）；与现有示意对齐 |
| P1 | 天地盖 `CoverBasset*`、开窗/挂孔/提手、袖套/抽屉 | 基模+特征或两件套 |
| P2 | 展示 PDQ、锁底变体 | code 分散，按缺口补 |
| P3 | 多边形、圆柱塑料、磁吸多图层精品 | 非标准 LWH / 多图层 |

验收（每个新模板）：

- [ ] 改尺寸后面片与折线合理更新  
- [ ] 合盖检测策略与现网一致（或明确标注示意级）  
- [ ] 可导出统一 Knife JSON  
- [ ] `manufacturingReady` 未达标前 UI 保持校样提示  

### 阶段 3 · 标准代号目录（可选，并行轻量）

- 从 FEFCO / ECMA **官方 PDF** 整理 `catalog.json`（仅代号、系列、名称）  
- 挂到模板的 `stdRefs[]`，用于搜索与对客说明  
- **不**作为 `generate()` 输入  

### 阶段 4 · 契约升级（中后期）

- 逐步提高 `productionReady` / 评估 `manufacturingReady`  
- 增加尺寸上下限、厚度约束、与 `openParams` 对齐  
- 校样导出与开模导出权限分离（若需要）  

---

## 5. 职责分工

| 仓库 | 做什么 | 不做什么 |
|------|--------|----------|
| **网站 BOXCRAFT** | 模板代码、`mapTemplate`、导入 UX、导出、契约 | 再爬 Pacdora |
| **webspider** | 已有数据只读；必要时导出 handoff 表；skill 维护 | 注册业务 `presets`；运行时供刀版坐标 |
| **国际标准 PDF** | 人工/半自动做代号表 | 当几何源 |

---

## 6. 风险与原则

1. **示意 ≠ 开模**：当前 Demo 已提示禁止直接开模；新模板默认同级，直至单独认证。  
2. **版权与合规**：Pacdora 几何仅作内部工程反推；不二次分发其原始 knife 作为产品模板库。FEFCO/ECMA 全文勿做成公开商用拷贝。  
3. **多图层硬盒**：不要早期承诺与 Pacdora 逐点一致；先保证参数闭环与可演示。  
4. **映射质量**：宁可「未映射」也不要错挂模板导致错误刀版。  

---

## 7. 近期两周建议排期

| 天 | 事项 |
|----|------|
| D1 | 网站现有 `templateId` 清单 + 与侧栏文案对齐；导出/确认 handoff 底表字段 |
| D2–D3 | 阶段 1：可映射批量挂载 + 抽检 |
| D4–D8 | 阶段 2：P0 缺模板补齐（按缺口最多的结构先做） |
| D9–D10 | 回填映射率统计；列 P1  backlog；更新本方案进度 |

---

## 8. 成功标准（MVP）

1. 导入尺寸目录中，**可映射类**选中后 100% 走自有模板重算。  
2. P0 结构均有可用 `templateId`，侧栏可切换、可导出 Knife JSON。  
3. 文档与 skill 口径一致：新模板来自自研生成器；Pacdora / 标准 PDF 定位如上。  
4. 不再把「继续全量采集 Pacdora」列为阻塞项。  

---

## 9. 参考链接与路径

- 网站：`http://localhost:5173/`（BOXCRAFT LAB）  
- 本仓几何：`data_search/exports/geometry/pacdora_boxes/`  
- 结构清单：`data_search/exports/structure_inventory/`  
- **17 类反推明细**：`data_search/exports/formula_diff/official_cats_reverse.md`（及 `.json`）  
- **飞机盒深度公式**：[Aircraft_openParams_反推公式.md](./Aircraft_openParams_反推公式.md)  
- **REA 严格反推（飞机盒）**：[REA_Aircraft_严格反推记录.md](./REA_Aircraft_严格反推记录.md)  
- **REA 严格反推（17 类）**：[REA_17cats_严格反推记录.md](./REA_17cats_严格反推记录.md)  
- **开窗 / 多边形入口**：[PairWithWindow_开窗反推公式.md](./PairWithWindow_开窗反推公式.md)、[CurveBox_多边形反推入口.md](./CurveBox_多边形反推入口.md)  
- REA 严格金样：`rea_strict_aircraft/`、`rea_strict_17cats/`、`rea_strict_window/` 等  
- 采集说明：`data search/.cursor/skills/pacdora-dieline-crawl/SKILL.md`  
- FEFCO 12th PDF（代号参考）：[FEFCO Code](https://www.fefco.org/technical-information/fefco-code)  
- ECMA Codes（折叠纸盒代号参考）：ECMA 官方 Codes PDF  

---

## 10. 下一步（执行入口）

1. 打开网站工程，定位 `presets` / `mapTemplate` / 各结构 `generate` 实现目录。  
2. 产出「现有 templateId ↔ 侧栏名称」表。  
3. 按阶段 1 挂载可映射尺寸；缺口进入阶段 2 P0（优先 §11.3 主结构：`Aircraft` / `Carton` / `Pair` / 天地盖）。  
4. 细项恒等式以 `exports/formula_diff/official_cats_reverse.md` 为准迭代。  

---

## 11. Pacdora.cn 17 官方子类 · openParams / 结构反推

> 对应站点侧栏：方形盒…其他（与 `structure_inventory/01_官方子类命中统计.csv` 一致）。  
> 方法：子类 ∩ 本地几何 → 主 `modeCate.code` → 面片恒等式 + openParams 比例；**不**把 cuts 点列写入 BOXCRAFT 运行时。  
> 生成脚本：`data_search/_reverse_all_official_cats.py`

### 11.1 总原则

| 层级 | 做法 |
|------|------|
| 官方子类 | 只做 **目录/筛选**（用户从「邮寄盒」进） |
| `modeCate.code` | 真正绑定 **templateId / generate()** |
| openParams | 自研默认值可用比例式；高级项做滑条，范围抄 `min/max` |
| 金样回归 | 用 `{num}.json` 比面片 w/h、孔距，不逐点拷贝路径 |

同一模型可属多个子类；映射以 code 为准，勿假设「一个子类 = 一个公式」。

### 11.2 子类 → 主 code → BOXCRAFT 动作

> **公式深度（rev4）**：`严格` = 已用**列表 id** 跑同级 knife 尺寸网格（见 [REA_17cats](./REA_17cats_严格反推记录.md)）；别名类复用同 id。

| 官方子类 | 映射数 | 主结构 code（频次） | 建议 template / 动作 | 公式深度 |
|----------|--------|---------------------|----------------------|----------|
| 方形盒 | 46 | `CoverBassetCardboardBox` 等 | 天地盖/抽屉/插舌 **按 code 分支** | **严格**（list 9411） |
| 礼盒 | 106 | `KnifePrototype`×42 为主 | Prototype **尺寸锁死示意**；参数化走钉扣/盖盒 | **严格***（5721 钉扣；5700 Prototype LWH 无效） |
| 邮寄盒 | 65 | `Aircraft*` / 托盘胶合 | **`generateAircraft`** | **严格**（list 1 + holes） |
| 运输箱 | 47 | `Carton`（0201） | **`generateCarton0201`** + FEFCO:0201 标签 | **严格**（list 3；`F=W/2+1`） |
| 产品盒 | 23 | `Pair*` | 复用插口/`Pair` | **严格**（list 6） |
| 食品盒 | 41 | `CanCylinder`×15 + 托盘 | 圆柱独立引擎；本地 `F=L×W` | **严格·负结论**（公开 LWH 再生无效） |
| 展示盒 | 153 | 极度分散 | 先 map；PDQ 用 Multifunction 代表 | **严格**（list 9601） |
| 折叠盒 | 230 | 与邮寄/插口交叉多 | **按 code**挂 Aircraft/Pair | **严格**（=邮寄 list 1） |
| 套筒与托盘盒 | 108 | 分散 + 部分 `CanCylinder` | `sleeve` / `drawerTray` | **严格**（list 730 Bufferwall） |
| 带窗的盒子 | 99 | `Pair*Window*` 等 | **Pair + window**（窗 bbox 已闭） | **严格**（list 138 → [开窗专文](./PairWithWindow_开窗反推公式.md)） |
| 带手柄的盒子 | 156 | 分散 | **基模 + handle** | **严格**（list 288） |
| 带盖盒 | 74 | `CoverBassetCardboardBox` | **`generateTrayLid`** | **严格**（list 529） |
| 挂盒 | 73 | `PairWithHook` | **`Pair` + hangHole** | **严格**（list 13） |
| 插口盒 | 320 | `Pair` 族最大 | **`generatePairRTE/STE`** | **严格**（=产品 list 6） |
| 多边形盒 | 176 | `CurveBox` / Star* | CurveBox 入口已闭；Star 极坐标未做；10600=锁底另轨 | **严格·分轨**（[CurveBox 入口](./CurveBox_多边形反推入口.md)） |
| 塑料盒 | 63 | `CanCylinder`×45 | H=0；展平 `F=L×W` | **严格·负结论**（=食品） |
| 其他 | 78 | 牛奶盒等 | 撕口自锁代表 + 兜底 | **严格**（list 5450） |

### 11.3 主结构公式（优先实现）

#### A. Aircraft（飞机盒 / 翻盖邮寄）— 已深挖

- 默认：`N=0.4W`，`SW=0.2W`，`SP=0.4W`，`K=2`  
- 面片：`H=L×W`，`FBL.w=N`，`FL.w=M≈H-SX`，`HL.w=DC`  
- 插孔：`margin=(W-((K-1)SP+SW))/2`，左右槽深≈`bleed`，`h=SW`  
- 尺寸 API：`knife?id=1&length&width&height`（刀版尺寸）  
- 全文：[Aircraft_openParams_反推公式.md](./Aircraft_openParams_反推公式.md)

#### B. Carton（常规纸箱 / FEFCO 0201 向）— 多样本闭合

代表：`200010` 等，`openParams`: `OF,R,G,GT,F,F1`。

```text
主体 H、F : w = L , h = H          # 前后墙
侧板 FR   : w = W , h = H
侧板 FL   : w ≈ W 或 W-1 , h = H
摇盖 HT/HB/FT/FB : w = L , h = F   # F 为 openParam
接合舌 HL : w = G , h ≈ H - 余量
经验：F = W/2 + 1 ； F1 = F + 2 （外/内摇盖差）— **REA 严格五组证实**（list id=3）
展开序：HL | H | FR | F | FL ，上下接 HT/HB 与 FT/FB
```

BOXCRAFT：侧栏「开槽纸箱 FEFCO 0201」应对此 `generate`；标签 `stdRefs: ["FEFCO:0201"]`。

#### C. Pair（反向插锁 / 管式插舌）— 插口盒主路径

代表：`100010` 族。`H`/`F`：`w=L,h=H`；`FR`/`FL`：`w=W,h=H`。  
openParams 常见：`G,GT,E,C,CR,AX,AXX,R,OF,NX,NY,A,ATT…`（粘舌、插锁槽、倒角）。  
防尘翼高多与 `C` 对齐（`HT1.h=C`）。  
默认粘舌 `G` 随尺寸缓变（小盒常 13～16），**勿**套 Aircraft 的 `0.4W`。

BOXCRAFT：直插 STE / 反向 RTE 两个 templateId，共享管式骨架，差在翼方向。

#### D. CoverBassetCardboardBox（露底对盖 / 天地盖向）

代表：`161012*`。`H=L×W`（底），墙 `HT/HB=L×H`；盖板 `F≈(L+5)×(W+5)`（D=0.5 样，+5 与板厚/收位相关）。  
openParams：`OF,C,W1,WR,TD,OH,TC,TW1,TWR`；`HTR/HTL.w=W1`。

### 11.4 各子类反推要点（压缩版）

完整表见 `exports/formula_diff/official_cats_reverse.md`。

1. **方形盒**：盖盒恒等式 `H=L×W`，`HT=L×H`，`HTR.w=W1`；结构杂，按 code 分流。  
2. **礼盒**：大量 `KnifePrototype` **无 openParams** → 仅尺寸驱动或示意几何。  
3. **邮寄盒 / 折叠盒**：`N/W≈0.4`，`SW/W≈0.2`，`SP/W≈0.4`，`M/H≈0.98`，`DC/H≈1.02`（与 Aircraft 一致）。  
4. **运输箱**：见 §11.3-B。  
5. **产品盒 / 插口盒 / 挂盒**：`Pair` 族；挂盒加 Hook 参数 `L1/A…`。  
6. **食品盒 / 塑料盒 / 部分套筒**：`CanCylinder` 且 **H=0**，单片 `F=L×W` → 与纸盒 LWH 引擎分流。  
7. **展示盒**：参数多（`SD,N,K,SW,SP,L1…`）但 code 分散；`SW/W≈0.2` 仍常见。  
8. **带窗**：在 Pair/翻盖面片上挖窗；窗口尺寸需二次差分（当前代表样部分无 openParams 列表）。  
9. **带手柄**：在基模加 `handle` 相关 `S1/K1/K3/MT…`（提手箱样）。  
10. **带盖盒**：见 §11.3-D。  
11. **多边形**：`W/H` 可为 0；必须极坐标/边数模型，单独立项。  
12. **其他**：牛奶盒等异形面命名（`HLL/FLT1…`）；低优先级。

### 11.5 网站落地优先级（修订）

| 优先级 | template | 覆盖子类入口 | 依据 |
|--------|----------|--------------|------|
| P0 | Aircraft 邮寄/飞机盒 | 邮寄盒、折叠盒部分 | 公式最完整 |
| P0 | Carton 0201 | 运输箱 | 面板恒等式清晰 |
| P0 | Pair STE/RTE | 插口盒、产品盒、挂盒基模 | 样本最多 |
| P1 | TrayLid 天地盖 | 带盖盒、方形盒部分、礼盒部分 | CoverBasset 恒等式 |
| P1 | 开窗 / 挂孔 / 提手 | 带窗、挂盒、带手柄 | 基模 + 特征 |
| P1 | Sleeve / Drawer | 套筒与托盘盒 | 两件套 |
| P2 | 展示 PDQ 等 | 展示盒 | code 分散 |
| P3 | 多边形 / 圆柱塑料 | 多边形、塑料、食品圆柱 | 非标准 LWH |

### 11.6 再生 API 备忘（反推用，非产品依赖）

```http
GET /api/v2/project/knife?id={列表id}&bleed=5&export_type=model&length={L}&width={W}&height={H}
```

- 先 `experience_user`；**`id` = 列表 id**（`pacdora_boxes_geom.csv`），**不是** `modeCate.id`/`cateId`。  
- `length/width/height` 对纸盒类已验证为**刀版尺寸**并重算默认 openParams（Aircraft/Carton/Pair/盖盒等）。  
- `CanCylinder` / `KnifePrototype`：**忽略** LWH 覆盖，恒回各自默认尺寸。  
- `PairWithWindow`：相对 F 的窗用 `X2/Y3/Y4/XR`（见开窗专文）。  
- 单独 PATCH 某一个 openParam 的公开接口未稳定暴露。  

### 11.7 产物索引

| 文件 | 内容 |
|------|------|
| [REA_17cats_严格反推记录.md](./REA_17cats_严格反推记录.md) | **17 类同级严格 REA 总表**（含补充缺口收口） |
| [PairWithWindow_开窗反推公式.md](./PairWithWindow_开窗反推公式.md) | 开窗 bbox 闭式 |
| [CurveBox_多边形反推入口.md](./CurveBox_多边形反推入口.md) | 多边形分轨入口 |
| [Aircraft_openParams_反推公式.md](./Aircraft_openParams_反推公式.md) | 邮寄飞机盒全文（含 §6.4 板厚） |
| [REA_Aircraft_严格反推记录.md](./REA_Aircraft_严格反推记录.md) | 飞机盒 holes 级 Evidence |
| `exports/formula_diff/rea_strict_17cats/` | 17 类尺寸网格金样 + `summary.json` |
| `exports/formula_diff/rea_strict_window/` | 开窗金样 |
| `exports/formula_diff/rea_strict_aircraft_thickness/` | 板厚分支 |
| `exports/formula_diff/rea_strict_cancylinder/` | 圆柱探测负结论 |
| `exports/formula_diff/rea_strict_curvebox/` | CurveBox 入口金样 |
| `exports/formula_diff/rea_strict_knifeprototype/` | Prototype 示意确认 |
| `exports/formula_diff/official_cats_reverse.md` | 17 类离线自动摘要（rev2） |
| `exports/formula_diff/official_cats_reverse.json` | 机器可读（含代表样 identities） |
| `exports/formula_diff/aircraft_size_grid/` | Aircraft 尺寸网格金样 |
| `exports/structure_inventory/04_*.csv` | 子类结构模板工程表 |
| `_rea_strict_17cats_diff.py` 等 | 严格差分 / 探测复跑脚本 |
