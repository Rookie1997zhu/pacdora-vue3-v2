# Packative 3D 映射裁决（Phase 0）

日期：2026-11-12（live 复裁同日）  
规格：`productbox-crashlock` 100×80×80  
证据：[`reports/packative-3d/evidence-bundle-crashlock-100_80_80.md`](./packative-3d/evidence-bundle-crashlock-100_80_80.md)  
Live：[`docs/packative-research/evidence/engview-live-100_80_80/`](../../../docs/packative-research/evidence/engview-live-100_80_80/)  
对照：[`src/pacdoraGeomKnife.js`](../../../src/pacdoraGeomKnife.js) / [`src/geomRig.js`](../../../src/geomRig.js)

## 唯一结论

**`mesh_only`**

含义：EngView Collada（bf9 **与** 2026-11-12 live）可支撑 **只读网格 +（若复用 Collada 动画时间轴）开合 scrub**；**不能**稳定对齐 Pacdora 式 `faces` / `hinges` / `foldStages` 以接入现有 `geomRig`。

## Live 复裁要点

| 项 | bf9 | live `collada.dae` |
|---|---|---|
| bytes | 1 173 018 | 1 173 018（sha **不同**） |
| SideResource 几何 | 15 | 15（同 id 集） |
| Panel 根节点 | 15 | 15（同 id 集） |
| channel rotate / translate | 14 / 14 | 14 / 14 |
| Pacdora `faces/hinges/foldStages` | 无 | 无 |
| Fold slider | 0..5500 | 观测当前值 5500 |

## 对照表

| Pacdora knife.v3 字段 | EngView Collada（bf9 + live）观察 | 裁决 |
|---|---|---|
| `faces[]`（`dlist`/outline、父子、`hingeLine`） | 15× `SideResource*` **三角网格**；无 2D `dlist` 命令流 | 不等价；可当 mesh 面，不可直接当 knife face |
| `folds` 名 `Parent_Child` | 无此命名；有 Panel 场景树 + rotate/translate channel | 树存在，但缺稳定 2D 铰链线段与命名契约 |
| `foldStages` / `animation.animations` | Collada 连续 keyframe（轴角 + BezierPoints）；UI slider 0..5500 | 连续 EngView 时间轴 ≠ 离散 foldStages |
| `hinges[].angle` / `axisVec` | rotate keys 含轴角序列；BezierPoints 为专有 morph | 可启发式估轴，但与 geomRig 铰链语义未验证 |
| UV / 贴图 | TEXCOORD + 设计空间矩阵 shader；TextureResource 常需会话 | mesh 预览可行；印前烘焙另议 |

## 为何不是 `faces_hinges_ok`

1. 几何真源是 **EngView 网格+自定义动画**，不是 Pacdora geometry JSON 面片轮廓。  
2. `crInfo*` / `curvedInfo*` 服务 shader 折痕，不是可导入的 hinge 拓扑表。  
3. **新鲜会话** live DAE 与 bf9 结构计数一致，仍抽不出可文档化、可复现的 hinge 树 + 阶段角对齐 geomRig。  
4. 从官方 SVG Creasing **猜**面片树被明确禁止。

## 为何不是 `blocked`

- Live 会话已取完整 Collada + TextureResource1..4 + 脱敏 network 摘要。  
- 无会话时 resource **403** 仍成立，但不否定「有会话时可取网格」。  
- Phase 1 仍可做 **Collada/mesh 只读预览**（不接 foldStages）。

## Phase 1 入口（本裁决下）

1. **只读 Collada/mesh 预览**（单规格）：会话或入库的 DAE → Three 加载；fold 仅 scrub Collada 动画时间或保持静态展开/闭合姿态。  
2. **不**改 [`packativeGeomKnife.js`](../../../src/packative/packativeGeomKnife.js) 填假 `faces`；Lab Packative 默认仍规范 2D。  
3. 若未来要 `faces_hinges_ok`：另开任务做「Collada Panel 树 → knife faces/hinges」转换器 + 多规格回归，并需可复现会话证据流水线。

## 门禁（Phase 0 保持）

- Lab：`faces:[]` / 无拓扑不提供 3D  
- `manufacturingReady=false`  
- 禁止 SVG→假 3D；禁止把证据 DAE 当生产 geom 静默发布
