BOXCRAFT 部署架构修订 V1.1 — 2026-11-10

以用户提供的两份原版 HTML 为基础修改，保留原业务方案与研究边界。
本包包含修订版方案、全部提示词 HTML/TXT 和从方案提取的部署样板。
本次未收到原 ZIP，故这是基于两份原版 HTML 重新生成的交付包；不包含无法取得的原 ZIP 附加证据文件。

运行架构：Caddy（Vue dist + TLS + API代理）→ 独立 Django backend。
PostgreSQL、Redis、Celery worker、scheduler、geometry 保持独立。
Node vue-build 仅为 Docker 构建阶段，不是生产前端服务。
唯一 Caddyfile 与 dist COPY 进入 Caddy 镜像。WEB_TAG 独立标记 Caddy 版本。

deploy 是目标项目的配置样板，不是完整网站源码。须将配置集成到原项目，
实现 Django/geometry 项目、Dockerfile.backend、Dockerfile.geometry、健康检查、
env.example、collectstatic/WhiteNoise 等前置内容后才能构建运行。
依赖版本保留原方案示意基线；正式发布按测试结果固定镜像摘要与锁文件。
首次部署、更新、回滚、持久化与验收详见方案第 17–20 章。

官方依据：
https://caddyserver.com/docs/caddyfile/patterns#single-page-apps-spas
https://docs.docker.com/build/building/multi-stage/
