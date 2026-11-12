# BOXCRAFT Packative → Lab — 差距报告（V1.2）

日期：2026-11-13  
依据：本地仓库 + [V1.2 方案](../packative-research/BOXCRAFT_Complete_Plan_Fresh_20261112/boxcraft_dieline_library_plan_v1_1/BOXCRAFT_Packative_Lab_Catalog_Plan_V1.2_2026-11-12.md)  
范围：相对 **现行主线** 的差距；旁路固定库已交付部分单独标注。

## 1. 一句话结论

**Packative 官方 SVG 已接入 Lab 规范 2D（crashlock + mailerbox + **pillowbox** 首批）；发布/旁路与 `verify:packative-geom` 已跑通。sleeve 匿名 CDN 全 403 → **blocked**（无假入库）。3D Phase 0 仍为 `mesh_only`；Lab 仍 `faces=[]`，`manufacturingReady=false`。**  
P1–P3 见 [`p3-lab-acceptance.md`](../../research/packative-dieline-lab/reports/p3-lab-acceptance.md)；holdout 见 [`p3-holdout-gates.md`](../../research/packative-dieline-lab/reports/p3-holdout-gates.md)。  
2D/发布：[packative-official-geom-2d.md](../../research/packative-dieline-lab/reports/packative-official-geom-2d.md)、[packative-publish-bypass.md](../../research/packative-dieline-lab/reports/packative-publish-bypass.md)、[packative-2d-harden.md](../../research/packative-dieline-lab/reports/packative-2d-harden.md)、[packative-mailerbox-2d.md](../../research/packative-dieline-lab/reports/packative-mailerbox-2d.md)、[packative-pillowbox-2d.md](../../research/packative-dieline-lab/reports/packative-pillowbox-2d.md)、[packative-sleeve-2d.md](../../research/packative-dieline-lab/reports/packative-sleeve-2d.md)。  
3D Phase 0：[packative-3d-map-verdict.md](../../research/packative-dieline-lab/reports/packative-3d-map-verdict.md)。

## 2. 主线差距

| 域 | 现状 | 差距 |
|---|---|---|
| Lab 选盒 | Packative 第三源；官方 SVG → knife.v3 2D（crashlock + mailer + **pillow**） | **sleeve** CDN blocked（见报告）；运输箱产品目录导入不在本轮 |
| Packative 目录 | catalog + `geom_rel` → `public/packative-geom/`（10+2+1） | crashlock 2 unvalidated 无 geom；mailer/pillow 仅 CDN 已缓存尺寸；sleeve 未入库 |
| 研究台 / Lab 回放 | 结构 gates；包络对齐 OLS；**Lab 规范 2D** | 厚度/kerf unvalidated；非完整参数 63/14 |
| REA 发布 / 回归 | `publish:packative-geom` + **`verify:packative-geom`** | CI 未绑；Compose 本轮未复跑；未接真网 Beat |
| 3D | Phase 0：`mesh_only`（live 100×80×80 已复裁，结构同 bf9）；Lab 仍无 3D（faces=[]） | Phase 1 可选只读 mesh 预览；`faces_hinges_ok` 需另建 Collada→knife 转换器 |

## 3. 旁路（V1.1）已交付摘要

| 域 | 状态 |
|---|---|
| `dieline_library` 模型/API/UI | 已有 |
| Packative CDN 运行时 + `--live` | 已有（mock 可测） |
| 本地官方 SVG 归档 | **10** 条非 example（validated+holdout crashlock，`reference_only`） |
| 真网库存条数 | 不以 `--live` 编造；本批为本地 evidence 导入 |

## 4. 可复用

- Pacdora 目录形态与 Lab 双页签交互  
- packative-dieline-lab 规则/原型/样本矩阵  
- `packativeGeomKnife`（SVG Cutting/Creasing → knife.v3 2D）  
- EngView Collada 证据 + [`engview-resource-contract.draft.json`](../../research/packative-dieline-lab/config/engview-resource-contract.draft.json)  
- 旁路 CDN 契约与采集器（作样本归档）  
- Asset / org 鉴权 / Caddy `/media` 阻断  

## 5. 明确不做（主线边界）

- 不接 PackFlow  
- 不把未验证几何注入 knife/templates  
- 不以研究台「结构验证」冒充 manufacturingReady  
- 不静默拉伸官方 SVG 冒充任意 LWH  
- 不从 Creasing 猜面片假 3D；未到 `faces_hinges_ok` 不接 Packative `geomRig`  

- 不自动 commit/push/deploy  

## 6. 三种能力（V1.2）

```text
BOXCRAFT
├─ 自有参数化：knife + templates          ← 已有
├─ Pacdora 尺寸目录：presets → Lab        ← 已有
├─ Packative 官方 SVG → Lab 规范 2D       ← 本阶段已接（无 3D）
└─ 固定原件库 dieline_library（旁路）     ← 框架已有
```
