# Packative 2D 主线夯实（crashlock only）

日期：2026-11-12  
范围：不扩盒型、不接 3D、不抬升 `manufacturingReady`。

## 命令

```bash
npm run verify:packative-geom
npm run build
```

脚本：[`scripts/verify-packative-geom.mjs`](../../../scripts/verify-packative-geom.mjs)  
npm：`verify:packative-geom`

## 校验结果

| 检查 | 结果 |
|---|---|
| catalog assets | 12（validated/holdout 10 + unvalidated 2） |
| `geom_rel` 文件存在 | 10/10 |
| unvalidated 无 `geom_rel` | `100_80_50`、`300_200_150` |
| 孤儿 SVG | 无 |
| SVG → knife 解析 | 10/10 通过 |
| 试点 100×80×80 | Cutting **133** / Creasing **14** |
| `faces` / `hinges` / `foldStages` | 均为空 |
| `manufacturingReady` / `productionReady` | `false` |

## dist 抽查

- `npm run build` 成功
- `dist/packative-geom/*.svg`：**10** 份齐全（与 public 一致）
- Compose：本工作目录无可用 `docker-compose.yml` 实机复跑 → **记「本地 dist 抽查通过 / Compose 未复跑」**

## Lab 行为核对（代码门禁，未改交互）

对照 [`LegacyLab.vue`](../../../src/legacy/LegacyLab.vue) + [`catalog.js`](../../../src/packative/catalog.js)：

| 行为 | 门禁 |
|---|---|
| validated 进工位 | `canEnterPackativeRow` 真；需 `geom_rel`；`loadPackativeGeomKnife` |
| holdout `100_80_90` | 可进；`packativeHoldoutLocked` 只读对照 |
| unvalidated | `canEnterPackativeRow` 假 → toast，不进工位 |
| 尺寸 | 进工位后写入 L/W/H；Packative 尺寸锁定 |
| 3D / 假折叠 | knife `faces:[]`；无 geomRig 接线 |

本轮**未修改** Lab 交互语义；verify 脚本内联复述 `canEnterPackativeRow` 口径。

## 门禁未变

- `packativeGeomKnife.js`：`faces:[]`，`manufacturingReady=false`
- 不扩其它盒型
- 不接 EngView / `geomRig`
