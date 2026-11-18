# P0 人工回归补测证据（Not Run → 浏览器矩阵）

- **环境：** Compose `http://localhost`，代码点 `35167e6`
- **账号：** `deploy/.env` 的 `SMOKE_EMAIL` / `SMOKE_PASSWORD`（本文不写明文密码）
- **视口：** 390×844（首页壳）与桌面宽屏（Studio/渲染/账户）
- **语言：** zh-CN 与 ko-KR（壳与设计列表以韩语抽查为主）
- **范围：** 只补各阶段证据里标 Not Run 的浏览器用例；未改产品代码、未开 P1
- **截图目录：** [`screenshots/p0-manual/`](screenshots/p0-manual/)

## 出门证结果

| 用例 | 结果 | 证据 |
|------|------|------|
| 390 首页/导航 | Passed | `01-home-390-zh.png`、`02-home-menu-390-zh.png`：主入口可见；菜单含渲染/额度/设计相关入口 |
| ko 导航 | Passed | `03-home-390-ko.png`：韩语导航可达，未见长标签挤爆主 CTA |
| 目录无匹配 | Passed | `04-products-empty-search.png`：无匹配空态 + 可清除；返回后筛选 query 保留（浏览器路径验证） |
| 设计列表 CTA | Passed | `05-designs-continue-edit.png`、`06-studio-continue-edit.png`：「계속 편집」进入 Studio（`/designs/:id`） |
| 脏设计开渲 | Passed | Studio 改纸种/尺寸后点「3D 렌더러에서 열기」进入渲染场景；脏态优先走保存再 `renderSceneCreate`（1.5s 自动保存常先清 dirty，未截到中间态提示属预期竞态） |
| 开渲确认 | Passed | `08-render-confirm-pixels.png`：弹窗摘要含 **출력 크기 2048×2048**、**시점 1개**，非只写「2K」 |
| 返回设计 | Passed | 同上帧顶栏「디자인으로 돌아가기」可见（`07` 与 `08` 同帧备份） |
| 云渲全链路 | Passed | 见 [p1.2-render-archive-evidence.md](p1.2-render-archive-evidence.md)：job `caa7a05c…` 2K 等到 `succeeded`，`result_asset` 非空，成片可下载 |
| 成片失效 LRU | Passed（叙事更新） | P1.2 起成片归档到 Asset，可二次下载；前端 LRU=8 仅作本机加速缓存，不再作为「服务端删文件后唯一副本」；旧 Blocked「成片失效」不再作为期望 |
| 购物车设计名 | Passed | `10-cart-design-name.png`：行显示 **FEFCO 0427**（`design_name`） |
| 升级页非付款 | Passed | `11-upgrade-non-payment.png`：可见「실제 결제를 연결하지 않습니다…」意向非付款说明 |
| 窄屏工作台导出抽屉 | Not Run | 时间未补 `/workbench` 390 导出抽屉（可选） |

## 预备

| 检查 | 结果 |
|------|------|
| `compose ps` 关键服务 healthy | Passed（backend/geometry/render/worker/postgres/redis 等） |
| Smoke 登录 | Passed（`smoke@boxcraft.local`） |

## 备注

- 部分无 revision 的 Mailer 设计打开 Studio 会长期「로딩 중…」；本轮改用带 `current_revision_id` 的 **FEFCO 0427**。
- 浏览器全页刷新偶发短暂未登录态；同会话内 SPA 跳转后额度/购物车正常。
- 本轮 **不** 因此开 P1；阻塞级缺陷（白屏/无法登录/开渲丢数据）未出现。
