# Packative 发布流水线 + 旁路归档（最小闭环）

日期：2026-11-12  
范围：validated + holdout crashlock；本地 evidence；无 `--live`；不扩盒型。

## 交付

| 项 | 路径 / 命令 |
|---|---|
| 发布脚本 | `scripts/publish-packative-geom.mjs` → `npm run publish:packative-geom` |
| 静态刀版 | `public/packative-geom/productbox-crashlock-*.svg`（10） |
| catalog | `docs/packative_lab_catalog/packative_catalog.{json,csv}` 字段 `geom_rel` |
| 旁路 manifest | `docs/dieline-library/fixtures/packative-crashlock-geom-manifest.json`（`is_example=false`） |
| 入库 | `import_dieline_manifest` → `dieline_library` 非 example **10** |

## 流程

```text
evidence SVG
  → publish:packative-geom（门禁：仅 validated|holdout）
  → public/packative-geom + catalog geom_rel + bypass manifest
  → import_dieline_manifest --files-root <含 packative-geom 的根>
  → /library/dielines（需登录，org 隔离）
```

## 本机执行记录

- `npm run publish:packative-geom`：published=10；skip unvalidated=`100x80x50`、`300x200x150`
- dry-run：10× `would_create`
- execute（Compose org `92898cd7-72ab-493e-a14a-200477815968`）：`created_revisions=10`，`failed=0`
- DB：`AssetVariant` total=10，`is_example=false`=10；`ImmutableRevision`=10；`manufacturing_status=reference_only`

Compose 后端无宿主机挂载时：将 `public/packative-geom` 与 manifest `docker cp` 进容器后再 import（见 `docs/dieline-library/README.md`）。

## 明确不做

- 真网 `--live` / Beat 定时爬取
- 扩其它盒型、注入 templates
- 假 3D、静默拉伸、`manufacturingReady=true`
