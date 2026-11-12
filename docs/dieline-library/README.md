# docs/dieline-library

BOXCRAFT **Packative → Lab** 与旁路固定原件库落地文档。

## 现行目标（V1.2）

像 Pacdora 一样：用 REA 采集/反推 Packative 参数，进入 Lab 选盒。  
方案：[V1.2 正文](../packative-research/BOXCRAFT_Complete_Plan_Fresh_20261112/boxcraft_dieline_library_plan_v1_1/BOXCRAFT_Packative_Lab_Catalog_Plan_V1.2_2026-11-12.md)

**主线现状**：Lab Packative 第三源 + 官方 SVG 规范 2D 已接；`npm run publish:packative-geom` 可重复发布静态刀版。

## 阅读顺序

1. [GAP.md](./GAP.md) — 相对 V1.2 主线的差距  
2. [DECISIONS.md](./DECISIONS.md) — 主线/旁路决策  
3. [EXECUTION_CHECKLIST.md](./EXECUTION_CHECKLIST.md) — 勾选清单  
4. [ACCEPTANCE.md](./ACCEPTANCE.md) — 旁路已验 + 主线说明  
5. [`packative-publish-bypass.md`](../../research/packative-dieline-lab/reports/packative-publish-bypass.md) — 发布+旁路归档验收  

## 历史旁路（V1.1，已交付框架）

- `dieline_library` + `/library/dielines`：固定规格原件归档 / 2D 预览 / 下载  
- Packative CDN 运行时：`--live` 真网；mock 可测  
- Cursor 旧 plan（phase1–4、`packative_online_runtime`）属 V1.1，**已被 V1.2 主线取代**

## 发布官方 geom（Lab 静态）

```bash
# 仓库根（pacdora-vue3-v2/）
npm run publish:packative-geom
# 可选：--dry-run / --skip-manifest
```

效果：evidence → `public/packative-geom/`；回写 catalog `geom_rel`；生成 [`fixtures/packative-crashlock-geom-manifest.json`](./fixtures/packative-crashlock-geom-manifest.json)。仅 validated|holdout。

## 旁路用法摘要

```bash
# 示例（不计库存）
python manage.py import_dieline_manifest \
  --org <ORG_UUID> \
  --manifest ../docs/dieline-library/fixtures/example-manifest.json \
  --files-root ../docs/dieline-library/fixtures \
  --dry-run

# 官方 crashlock 归档（非 example；files-root 指向含 packative-geom/ 的目录）
python manage.py import_dieline_manifest \
  --org <ORG_UUID> \
  --manifest ../docs/dieline-library/fixtures/packative-crashlock-geom-manifest.json \
  --files-root ../public \
  --dry-run
# 通过后去掉 --dry-run

# Compose 后端镜像无宿主机挂载时：先 docker cp public/packative-geom 与 manifest 进容器，再 --files-root 指向容器内目录

python manage.py run_dieline_acquisition \
  --org <ORG_UUID> \
  --adapter authorized_api \
  --dry-run
# 真网：加 --live --execute（本批归档未使用）
```

API（需登录）：`/api/v1/dieline-library/variants/` 等。
