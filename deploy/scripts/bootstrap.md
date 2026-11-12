# BOXCRAFT 部署与管理员初始化

## 首次部署（Linux / Docker Compose）

```bash
cp deploy/env.example deploy/.env
# 编辑 deploy/.env 填入密钥与域名
# 本机冒烟保持 SITE_ADDRESS=http://localhost（关闭自动 HTTPS）；公网域名再改为 example.com
# 填好 SMOKE_EMAIL / SMOKE_PASSWORD（与下方 smoke 用户一致）

docker compose --env-file deploy/.env -f deploy/compose.yaml build
docker compose --env-file deploy/.env -f deploy/compose.yaml --profile maintenance run --rm migrate
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d
docker compose --env-file deploy/.env -f deploy/compose.yaml exec backend \
  python manage.py seed_catalog
docker compose --env-file deploy/.env -f deploy/compose.yaml exec backend \
  python manage.py createsuperuser
# 超管用于自研控制台 /console（已移除 Django Admin）；也可创建冒烟用户（SMOKE_*）
```

冒烟（Caddy `:80`，Host 需匹配 `SITE_ADDRESS`）：

```bash
# 从仓库根目录；会读取 shell 或你 export 的 SMOKE_*；也可：
set -a && source deploy/.env && set +a   # bash
node deploy/scripts/compose-smoke.mjs
# 默认 BASE_URL=http://localhost
# 覆盖 compose 路径：COMPOSE_FILE=deploy/compose.yaml ENV_FILE=deploy/.env
```

仅更新前端（不重建数据库）：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build --no-deps caddy
```

## P8.1 验收清单（本机 localhost）

排除：公网 TLS、支付、异步缩略图、完整印前。

1. `docker compose --env-file deploy/.env -f deploy/compose.yaml ps`  
   断言 `backend` / `geometry` / `worker` 为 **healthy**（worker 含 celery ping healthcheck）。
2. `seed_catalog` 已跑；`SMOKE_EMAIL`/`SMOKE_PASSWORD` 对应用户已创建。
3. `node deploy/scripts/compose-smoke.mjs` 全绿：  
   health · products · `/media`→404 · SPA `#app` · 鉴权上传/下载 · 未鉴权 401/403 · worker `inspect ping`。
4. 卷持久化（**不要** `down -v`）：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --force-recreate backend
# 等待 healthy 后：
curl -sS http://localhost/api/v1/health/
curl -sS http://localhost/api/v1/products/
node deploy/scripts/compose-smoke.mjs
```

5. 备份要点（示例，按需改容器名）：

```bash
# 数据库
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T postgres \
  pg_dump -U boxcraft boxcraft > boxcraft-pg.dump

# media 卷在 Docker volume `*_media_data`；恢复时保留 pg_data + media_data，再 migrate/up
```

- 卷：`pg_data`、`redis_data`、`media_data`、`caddy_data`、`caddy_config`
- 回滚：保留卷，切换 `APP_TAG`/`WEB_TAG` 镜像后 `up -d`
- **禁止**日常排障 `docker compose down -v`

## Windows Docker Desktop：基镜像拉取失败

症状：`node:22-alpine` 拉取时报 **metadata size validation**（或类似 registry/cache 错误）。

1. 确认引擎：`docker info`（Server 段应可用）
2. 复现：`docker pull node:22-alpine`
3. 清理构建缓存后重试（**不要** `compose down -v`）：
   ```bash
   docker builder prune -f
   docker pull node:22-alpine
   ```
4. 仍失败：在 `deploy/.env` 覆盖镜像源，例如：
   ```env
   NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine
   CADDY_IMAGE=docker.m.daocloud.io/library/caddy:2-alpine
   PYTHON_IMAGE=docker.m.daocloud.io/library/python:3.12-slim-bookworm
   POSTGRES_IMAGE=docker.m.daocloud.io/library/postgres:17-alpine
   REDIS_IMAGE=docker.m.daocloud.io/library/redis:7-alpine
   ```
   （地址以你可用的镜像站为准；geometry/caddy 支持 `NODE_IMAGE`，backend 支持 `PYTHON_IMAGE`。）
5. 再构建：`docker compose --env-file deploy/.env -f deploy/compose.yaml build`

## 本地开发（无 Compose 全栈）

```bash
# 终端 1：几何服务
cd services/geometry && npm install && node server.mjs

# 终端 2：Django
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
set DJANGO_SETTINGS_MODULE=config.settings.development
python manage.py migrate
python manage.py createsuperuser  # 登录 /console（已移除 Django Admin）
python manage.py runserver 0.0.0.0:8000

# 终端 3：Vite
npm run dev
```

Vite 开发时通过同源或代理访问 `/api/v1`；可在 `vite.config.js` 增加 `server.proxy['/api']`。
