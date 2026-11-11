# Blockers

| ID | 阶段 | 描述 | 状态 | 条件 |
|----|------|------|------|------|
| B-AI-KEY | P4 | 真实图像 API 调用 | Resolved | 2026-11-11：`AI_PROVIDER=gemini` + `gemini-2.5-flash-image` eager 冒烟 Passed（job/asset 落库+幂等）；缺 key 仍 `CAPABILITY_UNAVAILABLE`，不伪造成功；key 不入库 |
| B-SMTP | P1 | 密码重置邮件实际投递 | Blocked | `EMAIL_BACKEND_MODE=disabled`；API/token 已实现，`delivery=blocked` |
| B-OAUTH | P1+ | Google/Kakao/Naver OAuth | Blocked | 无商户凭据；不做假成功 |
| B-GEOM-LICENSE | P5 | pacdora 几何快照商业复用 | Open | 需来源/授权登记；P5.1/P5.2 仅 SIZE_LOCKED + seed limits 本地闸门/前端范围提示，未复用/分发 pacdora `shipping-geom` 快照 |
| B-DOCKER-PULL | P1 | Compose 镜像构建 | Resolved | 2026-11-10：官方 Hub `node:22-alpine` 仍 size validation；用 DaoCloud 镜像 + `NODE_IMAGE`/`PYTHON_IMAGE` 等覆盖后 build 成功 |
| B-COMPOSE-E2E | P1 | Caddy 公网入口全栈冒烟 | Resolved | 2026-11-10：`compose up` healthy；`compose-smoke.mjs` Passed（health/products/media404/SPA）；本机 `SITE_ADDRESS=http://localhost` |
| B-P2-BROWSER | P2 | 产品→设计→自动保存浏览器 E2E | Resolved | 2026-11-10 本机三进程冒烟 Passed；并修复 CSRF 信任源含 Vite `:5173` |

无密钥、客户数据或未授权素材进入仓库。`deploy/.env` 与 `backend/media/` 已 gitignore。
