# REA / 运行环境实录（阶段 1）

生成时间：本轮离线执行。未安装或升级 REA。

## Node / OS

| 项 | 值 |
|---|---|
| Node | v25.2.1 |
| npm | 11.6.2 |
| OS | Windows 10 (win32) |
| 工作区 | `pacdora-vue3-v2/pacdora-vue3-v2` |
| git HEAD | `59ae1f8637f19cc655562bb2029fcb4fddcccd7f`（`main...origin/main`，工作区有大量未提交变更） |

## 本机暴露的 `user-rea` 工具（MCP 检索实录）

下列名称来自当前会话 `GetDynamicTools` 对 `user-rea` 的 pattern 检索结果，**不是**臆造清单：

| 工具名 | 用途摘要（截断描述） |
|---|---|
| `list_browser_targets` | 列出 loopback CDP 页面目标 |
| `inspect_web_page` | 被动检查页面（不执行 JS / 不导航） |
| `inspect_web_network_capture` | 网络捕获摘要与分页查看 |
| `inspect_web_event_listeners` | 检查主文档 CSS 匹配节点上的监听器 |
| `observe_web_session` | 用户操作期间的 CDP 观察窗 |
| `observe_web_execution` | 有限覆盖窗口插桩 |
| `export_web_scripts` | 从已保留的 web 捕获导出脚本字节 |
| `compare_web_captures` | 比较两次 web 捕获 |
| `analyze_javascript_application` | 静态重建本地 ASAR/JS 应用图（不执行） |
| `inspect_artifact` | 检查归档/应用包内容寻址图 |
| `compare_artifacts` | 比较制品清单 |
| `export_evidence_bundle` | 写出会话 Evidence bundle |
| `binary_overview` | 已绑定文档的过程/段概览 |
| `close_binary` | 关闭二进制会话 |
| `inspect_packet_capture` | TShark 检查本地抓包 |
| `inspect_packet_fields` | 发现 TShark 协议/字段 |

本轮刀版研究口径已纠正：允许未授权白名单采集（CDN dieline.svg / editor 观察）；REA 能力可辅助页面观察。

## 边界（仍禁止）

- 禁止付费导出 / 购物车下单 / 导出发信（`paid_actions=false`）
- 禁止复用他人 Cookie / Token（`credential_reuse`）
- 不以 EPS BoundingBox 顶替刀版尺寸
