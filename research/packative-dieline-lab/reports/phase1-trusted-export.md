# Phase 1 — 可信导出链路

日期：2026-11-13  
基线：`phase0b-compose-e2e.md` + commit 工作区变更  
范围：GeometryDocument / hash、validate↔export 对齐、gate GEOMETRY+UNIT、Packative 单位、proof/engineering 导出、strict 输入。  
**不宣称生产级；无实物打样。**

## 修改文件清单

| 文件 | 变更 |
|---|---|
| `packages/geometry-schema/geometryDocument.mjs` | **新增** GeometryDocument + `g1:` canonical SHA-256 |
| `packages/geometry-schema/geometry-document.v1.schema.json` | **新增** schema |
| `services/geometry/server.mjs` | 归一化一次输入 → 单次 `createKnife(strict)` → validate/export 同 hash；manufacturing 拒 untrusted/approx/invalid |
| `deploy/Dockerfile.geometry` | COPY `packages/geometry-schema` |
| `backend/apps/exports/services.py` | gate 增 `GEOMETRY`、`UNIT_TRUSTED` |
| `backend/tests/test_exports.py` | 几何失败 / 单位不信任拒绝用例；fake validate 带 unit |
| `src/knife.js` | `strict`/`production`：未知模板与越限抛错，不静默夹取 |
| `src/knifeContract.js` | `BLOCKING_CHECK_IDS` / `blockingFailed` |
| `src/exportDieline.js` | proof vs manufacturing SVG/PDF；工程 SVG 物理 mm |
| `src/packative/packativeGeomKnife.js` | viewBox/绝对尺寸 → `unitConfidence`；无证据不标 trusted |
| `src/pacdoraGeomKnife.js` | locked-sample provenance |
| `services/geometry/test/geometry-document.test.mjs` | **新增** hash/strict/SVG/单位测试 |
| `research/.../phase0b-compose-e2e.md` | E2E 基线 |
| `research/.../phase1-trusted-export.md` | 本报告 |

## 数据库

无迁移。`DesignRevision.geometry_hash` 对新生成可变为 `g1:<sha256>`；旧弱 hash 仍可读。旧审批不自动升级。

## API

`POST /validate`、`POST /export` 响应增补：`geometry_hash`（g1）、`unit_confidence`、`unit_trusted`、`geometry_document`（validate）。无破坏性 URL 变更。

## 测试结果

| 项 | 状态 |
|---|---|
| `node --test services/geometry/test/*.test.mjs`（6） | **Passed** |
| `npm run verify:packative-geom` | **Passed** |
| Compose smoke（重建后） | **Passed** |
| `manage.py test tests.test_exports`（12，含新拒绝路径） | **Passed** |
| geometry 容器 `/validate` 返回 `g1:` hash | **Passed** |
| `tests.test_dieline_library` | **Blocked**（既有 DB connection closed，与本阶段无关） |
| 独立 CAD 回读 / 实物打样 | **Not Run** |

## 残留风险

- Packative 现网 SVG 多无绝对 width/height → `unitConfidence=untrusted`，工程导出应阻断（符合设计）。
- PDF engineering 仍可能非 1:1 页面缩放；已标注 scale，未宣称 `physical_mm`。
- 前端预览路径仍可非 strict 夹取；仅 Node geometry strict。
- geometry/backend 需重建镜像后生效（已本机 recreate）。

## 回滚

1. 还原上述文件 / 回退镜像 tag。  
2. gate 去掉 GEOMETRY/UNIT_TRUSTED 两项即可恢复旧制造门槛行为。  
3. 旧校样 `vector_proof` 未强制新单位门禁，可继续使用。

## 下一阶段（未做）

FEFCO 0201 限定材料/设备实物验证（阶段 2）。
