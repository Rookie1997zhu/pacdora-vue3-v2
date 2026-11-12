# BOXCRAFT Packative → Lab 参数目录方案

**版本：V1.2｜日期：2026-11-12｜状态：现行方案｜适用环境：本地 BOXCRAFT + Cursor + 已安装 REA**

> **V1.2 目标切换**：主交付不再是「现成固定规格刀版素材库囤货」，而是 **像 Pacdora 一样**：用 REA 观察 Packative 入口与样本 → 采集参数/多样本刀版 → 差分与规则验证 → 写入 Lab 可用目录（尺寸/几何），在已验证范围内选盒与改尺寸。  
> V1.1 固定原件库（`dieline_library`）降为**证据归档与参考下载旁路**，不阻塞本主线。  
> V1.1 正文仍保留只读历史：[`BOXCRAFT_Dieline_Library_Plan_V1.1_2026-11-12.md`](./BOXCRAFT_Dieline_Library_Plan_V1.1_2026-11-12.md)。HTML 副本以 MD 为准，本版不强制同步 HTML。

## 00｜项目边界（继承 V1.1，未改）

| 项 | 要求 |
|---|---|
| 唯一实施对象 | 本地 BOXCRAFT（`Rookie1997zhu/pacdora-vue3-v2`） |
| PackFlow | 不接入、不同步、不共享运行资源 |
| Git | 不自动 clone/pull/commit/push/deploy |
| 代码依据 | 以本地工作区为准；增量改动，不重建整站 |

## 01｜三种能力（V1.2 重写）

```text
BOXCRAFT
├─ 自有参数化模板：尺寸 → 已验证自有规则 → knife 重算
├─ Pacdora 尺寸目录：presets + geom → Lab「导入尺寸目录」
└─ Packative 参数目录（本方案主线）：REA 采样 + 规则/几何 → Lab「Packative」源

旁路（可选）
└─ 固定原件库 dieline_library：获准 SVG 等原件归档 / 2D 安全预览 / 权限下载
```

对齐对象：[`docs/pacdora_shipping_boxes/`](../../../pacdora_shipping_boxes/) + [`src/catalog/presets.js`](../../../../src/catalog/presets.js) + Lab。

### 禁止项（保持）

- 不得把未验证第三方切压线直接注入 `src/knife.js` / 自研 `src/templates/` 冒充自有引擎。
- 不得把「目录可改尺寸」写成「原件已入库」；presets/geom 是尺寸与几何回放链路，不是固定资产库。
- 缺少面板/铰链拓扑时**只做 2D**，不虚构 3D，不默认承诺 EngView Collada。
- `paid_actions=false`；不 Beat 全站定时爬；不枚举跨租户 UUID / 隐藏 CDN。

## 02｜产品定位与主指标

**第一优先级：**用户在 Lab 中切换到 **Packative** 源，选择盒型（首批 `productbox-crashlock`），在已验证尺寸范围内调整 L/W/H，得到与研究样本一致的展开几何（或明确的未验证提示）。

| 路线 | V1.2 角色 | 核心成果 |
|---|---|---|
| P. Packative → Lab 目录 | **主线** | 目录、规则/几何版本、Lab 页签、验证报告 |
| B. 参数研究台 | 证据与规则源 | `research/packative-dieline-lab/` 样本、差分、原型 |
| A. 固定原件库 | **旁路** | 可选归档同一批 SVG；不以资产数为唯一主指标 |

**实施顺序：**  
1）REA 复核入口 + 复用研究台 crashlock 规则  
2）产出 Pacdora 同构目录（CSV/JSON/geom 或等价 presets）  
3）Lab 第三源接线  
4）验收对比 raw 样本  
5）再扩其它盒型；固定库归档按需并行  

## 03｜REA 与采集职责（V1.2）

| 角色 | 做什么 |
|---|---|
| **REA** | 观察可访问目录、产品、输入字段、规格/材料选项、生成/下载路径与运行时证据；支撑参数口径与样本矩阵，不编造未观察接口 |
| **Scrapy / 确定性采集** | 按核实入口拉多样本（控制变量 L/W/H），校验 SVG Cutting/Creasing，落盘研究目录；可选用现有 CDN 契约小批 |
| **规则/原型** | 差分 → candidate/validated 规则 → 原型生成器（研究台已有 crashlock 结构闭环） |
| **Lab 接线** | 目录进入 catalog 或等价 Packative 源；改尺寸仅已验证范围 |
| **旁路归档** | 同一 SVG 可进 `dieline_library`（`--live`），供参考下载；不替代 Lab 主线 |

采集单位仍记录：`来源模板 + 版本 + L/W/H + 尺寸口径 + 材料/可见选项 + 格式 + 证据引用`，但用途是**参数矩阵与规则验证**，不是单纯囤 50 个固定资产。

## 04｜目录字段最低集（对齐 Pacdora）

| 字段 | 说明 |
|---|---|
| 模板标识 | 如 `productbox-crashlock` |
| 显示名（中/韩） | Lab 列表 |
| 默认/候选 LWH | mm；口径 inner/outer/unknown 显式 |
| 来源证据 | REA/研究台路径或契约 id |
| 规则或几何版本 | 可追溯 |
| 验证状态 | validated / holdout / unvalidated |
| geom 或 generator 挂钩 | 回放或已验证原型；禁止静默拉伸原 SVG |

未命中验证范围：提示「申请补充 / 未验证」，**禁止**悄悄缩放原图冒充新规格。

## 05｜Lab UX

- 与「已有刀版 / Pacdora 导入目录」并列增加 **Packative** 源（第三页签或等价筛选）。
- 点开：2D 展开预览（研究原型或 geom）；改尺寸走验证范围。
- 不默认提供 3D；有独立 3D 证据时另挂，不从平面 SVG 臆造折叠。

## 06｜与已交付旁路的关系

V1.1 阶段已落地（仍有效，但非主指标）：

- `backend/apps/dieline_library/` + `/library/dielines`
- Packative CDN crashlock 运行时（`packative_cdn_crashlock` + Scrapy/direct + `import_local_manifest`）
- CLI `--live`；mock 测试

Cursor 历史执行 plan（phase1–4、`packative_online_runtime`）对应 **V1.1 固定库**；**已被本 V1.2 Lab 目录目标取代为实施主线**。旁路代码可保留复用为样本归档。

## 07｜验收口径（主）

| 项 | 通过标准 |
|---|---|
| Lab 可见 Packative 源 | 与自研/Pacdora 并列可选 |
| crashlock 验证规格 | 改尺寸后几何与 holdout/样本门槛一致（沿用研究台 gates） |
| 未验证规格 | 有明确阻断或提示，无静默拉伸 |
| 证据可追溯 | 目录项能指回研究台/REA 证据 |
| 不冒充自有引擎 | 无未授权写入 knife/templates |
| 旁路固定库 | 可选；失败不编造库存数 |

次要：固定库下载/预览权限测试仍可回归，但不作为 V1.2 主成功标准。

## 08｜明确不做（本版方案声明）

- 本文件修订阶段不改 Vue/Django 业务代码、不跑真网采集、不自动 commit（实施另开任务）。
- 不把研究台原型直接标为 `productionReady` / `manufacturingReady`。
- 不接入 PackFlow；不恢复全站公式；不收费商城。

## 09｜提示词与落地文档

以本 V1.2 为准更新：

- `prompts/00`–`04`
- [`docs/dieline-library/`](../../../dieline-library/) 下 DECISIONS / GAP / EXECUTION_CHECKLIST / ACCEPTANCE / README

执行时把 **本 MD + `prompts/00_Master_Implementation_Prompt.txt`** 交给 Cursor；旧任务先发 `04` 纠偏。
