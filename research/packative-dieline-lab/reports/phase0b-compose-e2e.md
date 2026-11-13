# Phase 0b — Compose / Django E2E 基线

日期：2026-11-13  
基线 commit：`d3c4ae1b71860f8e8e0d55464ccfc85d6e09fabf`  
工作目录：仓库根（内层 `pacdora-vue3-v2`）  
约束：未执行 `docker compose down -v`

## 结果表

| 项 | 状态 | 证据 |
|---|---|---|
| Compose `ps`：backend / geometry / worker healthy | **Passed** | 全部 Up (healthy)；caddy/postgres/redis/scheduler 亦 Up |
| `node deploy/scripts/compose-smoke.mjs` | **Passed** | health、products=54、`/media`→404、SPA `#app`、csrf/login、asset ACL、thumbnail、worker ping + media queue |
| `python manage.py test tests.test_exports` | **Passed** | Ran 10 tests in 33.140s — OK |
| `tests.test_packative_runtime` + `tests.test_dieline_library`（同批） | **Failed** | Ran 17，errors=7（`psycopg OperationalError: the connection is closed`，疑似并发/测试库争用） |
| `tests.test_packative_runtime`（单独重跑） | **Passed** | Ran 7 in 6.974s — OK |
| `tests.test_dieline_library`（单独重跑） | **Failed** | Ran 10，errors=7（同样 `connection is closed`）；记 **Blocked** 排查，不阻断阶段 1 导出主路径 |
| `node --test services/geometry/test/validate.test.mjs` | **Passed** | 2 pass / 0 fail |
| `npm run verify:packative-geom` | **Passed** | 13 SVG parsed OK |

## 门禁裁决

导出主路径（Compose smoke + `test_exports` + geometry/packative geom）**Passed**。  
`test_dieline_library` 单独失败属既有 DB 连接问题（**Blocked**），不阻断阶段 1。

进入阶段 1：可信导出链路。
