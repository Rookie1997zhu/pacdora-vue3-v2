# BOXCRAFT Packative → Lab 方案包（现行 V1.2）

日期：2026-11-12。唯一实施对象：本地 BOXCRAFT（Rookie1997zhu/pacdora-vue3-v2）。本轮不接入 PackFlow。

## 现行主方案（V1.2）

**目标：**像 Pacdora 一样，用 REA 采集/反推 Packative 参数，进入 Lab 选盒（尺寸目录 + 可验证几何）。

- **主文件：**[`BOXCRAFT_Packative_Lab_Catalog_Plan_V1.2_2026-11-12.md`](./BOXCRAFT_Packative_Lab_Catalog_Plan_V1.2_2026-11-12.md)
- **提示词：**`prompts/00`–`04`（已按 V1.2 改写）
- **落地决策：**[`docs/dieline-library/`](../../../dieline-library/)

固定原件库（`dieline_library` / `/library/dielines`）为**旁路**，不是 V1.2 第一优先级。

## 历史（V1.1，只读）

- `BOXCRAFT_Dieline_Library_Plan_V1.1_2026-11-12.md` / `.html`：现成固定规格素材库方案（已被 V1.2 主线取代）
- HTML 以 MD 为准；V1.2 **不强制**同步 HTML 副本
- Cursor 旧执行 plan（phase1–4、`packative_online_runtime`）属于 V1.1 固定库阶段，见 CHANGELOG

## 使用文件

| 文件 | 用途 |
|---|---|
| `BOXCRAFT_Packative_Lab_Catalog_Plan_V1.2_2026-11-12.md` | 现行方案正文 |
| `prompts/00_Master_Implementation_Prompt.txt` | 完整实施任务（Lab Packative 主线） |
| `prompts/01_REA_and_Collection_Prompt.txt` | REA 采样与参数/规则采集 |
| `prompts/02_Library_Development_Prompt.txt` | Lab 第三源 + 旁路库 |
| `prompts/03_QA_and_Acceptance_Prompt.txt` | 验收（Lab/验证范围为主） |
| `prompts/04_Project_Scope_Correction_Prompt.txt` | 纠偏：勿再只做固定 SVG 囤货 |
| `contracts/` | 规划级契约（旁路清单仍可用；数据格式 1.0） |
| `CHANGELOG.md` | 版本实质修改 |
| `MANIFEST.json` | 本包文件清单 |

## 正确执行方式

把 **V1.2 方案 + `00` 总提示词** 交给本地 BOXCRAFT 工作区中的 Cursor。不重新 clone/pull，不覆盖本地修改，不引入 PackFlow。已在跑 V1.1 固定库任务时先发 `04` 纠偏。

对齐 Pacdora：`docs/pacdora_shipping_boxes/` + `src/catalog/presets.js` + Lab；研究证据优先复用 `research/packative-dieline-lab/`（crashlock）。

## 边界

- 方案包 ≠ 已完成 Lab Packative 接线；实施另开任务。
- 不把研究原型标为 manufacturingReady。
- `paid_actions=false`；不枚举跨租户资源。
