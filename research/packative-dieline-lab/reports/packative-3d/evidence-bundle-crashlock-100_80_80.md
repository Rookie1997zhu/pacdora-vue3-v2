# EngView 3D 证据包 — productbox-crashlock 100×80×80

日期：2026-11-12  
范围：Phase 0 捕获/整理；**不**绕过鉴权、**不**复用凭据（`access-scope.json`：`credential_reuse` / `paid_actions` 禁止）。

## 1. 规格与链路（研究已验证）

| 项 | 值 |
|---|---|
| 产品 | `productbox-crashlock` |
| 规格 | 100×80×80（inner） |
| 2D CDN | `studio-cdn.packative.com/{tenant}/dielines/productbox-crashlock/100_80_80/dieline.svg`（匿名可取；非 3D） |
| 3D Host | `cad.packative.com`（`NEXT_PUBLIC_ENGVIEW_URL`） |
| 链路 | `resize-service` → resize-session / get-template-info / resize-template → `resource-service/api/v1/resource/{session}/{id\|TextureResourceN.png}` |
| Fold UI | slider `aria-valuemin=0` / `max=5500` |

索引来源：[`06-2D与3D联动技术研究.md`](../../../../docs/packative-research/06-2D与3D联动技术研究.md)、[`phase3-deepen-3d-export-boxes.txt`](../../../../docs/packative-research/evidence/phase3-deepen-3d-export-boxes.txt)。

## 2. 本地落盘资产（本仓库）

| 文件 | 说明 |
|---|---|
| [`cad-collada-bf9ac3b1.dae`](../../../../docs/packative-research/evidence/cad-collada-bf9ac3b1.dae) | EngView Collada ≈1.17MB；sha256 `293230a52677…fdd0` |
| [`cad-tex-bf9-TextureResource{1..4}.png`](../../../../docs/packative-research/evidence/) | 纹理；1/3≈35KB，2/4≈77B 占位 |
| [`cad-collada-adf1b71b.dae`](../../../../docs/packative-research/evidence/cad-collada-adf1b71b.dae) | 第二份 Collada 快照（不同 sha） |
| [`cad-collada-headers.txt`](../../../../docs/packative-research/evidence/cad-collada-headers.txt) + [`cad-sample.dae`](../../../../docs/packative-research/evidence/cad-sample.dae) | **无会话**拉取 → `403` / `RESOURCE_8 Forbidden` |
| `phase3-editor-3d-*.png` | 编辑器 3D/UV/fold 观察截图 |
| `area_mask-100_80_80.png` / `dieline-png-100_80_80.png` | 同规格 2D 侧资产（编辑器） |

## 3. 本轮复验（2026-11-12）

| 检查 | 结果 |
|---|---|
| 匿名探测 `cad.packative.com/resource-service/...` | 无有效 session UUID 时不可取完整 Collada（历史 403 证据仍有效；随意 path → 404 JSON） |
| 登录会话新鲜抓取 100×80×80 | **已执行**（见 §3.1 live 轮次）；不入库 cookie / 不复用凭据 |
| 既有 bf9 DAE 结构可读 | **是**（见下节摘要） |

结论：Phase 0 在 **人工登录 Studio** 后完成新鲜会话落盘；与 bf9 结构计数一致，sha 不同；仍无 Pacdora `faces/hinges/foldStages` 可抽出字段。

## 3.1 Live 轮次（2026-11-12 · engview-live-100_80_80）

目录：[`docs/packative-research/evidence/engview-live-100_80_80/`](../../../../docs/packative-research/evidence/engview-live-100_80_80/)

| 资产 | 说明 |
|---|---|
| `collada.dae` | 会话 Collada `model/vnd.collada+xml` 1 173 018 B；sha256 `27adc403ad21…6fd6`（≠ bf9） |
| `TextureResource1..4.png` | 1/3≈31KB；2/4=77B 占位 PNG（与历史形态一致） |
| `network-summary.json` | 脱敏 URL（`{uuid}`）+ 状态码；含 resize-service / resource-service |
| `structure-compare.json` | 对照 bf9：15× SideResource、15× Panel 根、rotate/translate channel 各 14 |

| 观测 | 值 |
|---|---|
| 编辑器 | `/editor/productbox-crashlock/…?length=100&width=80&height=80` |
| Fold slider | min=0 / max=5500 / observed=5500 |
| 链路 | `session(204)` → `get-template-info` → `resize-template` → Collada + TextureResource*|

## 4. Collada 结构摘要（bf9）

| 结构 | 计数 / 观察 |
|---|---|
| `library_geometries` / meshes | 15× `SideResource*` 三角网格 |
| Panel 节点 | 15 个 `PanelNN_node_`（根 `Panel15_node_`） |
| 场景父子树 | 有（例：`geometry → Panel15 → Panel18/30/54/57 → …`） |
| `channel` rotate / translate | 各 14（子面板相对父级） |
| rotate keys | 轴角 `X Y Z A`，A 随时间变化（例 Panel18：0→180→90），**连续曲线** |
| `BezierPoints` / `BezierProps` | EngView 自定义动画通道（大量） |
| `TEXCOORD` | 有；配合 GLSL `vertexToDesignMatrix` / `designToVertexMatrix` |
| `crInfo*` / `curvedInfo*` | 折痕/曲率相关顶点属性（shader），**不是** Pacdora `Parent_Child` 铰链名 |
| `library_controllers` / joints | 无经典 skin joint 铰链 |

## 5. 与 2D 官方 geom 关系

- Lab 2D：`public/packative-geom/productbox-crashlock-100_80_80.svg`（Cutting/Creasing）
- 3D：EngView Collada（会话资源）；**不得**从 SVG Creasing 臆造面片树
- 本包不宣称 bf9 ≡ 当前 CDN 租户最新会话输出；仅作映射研究证据
