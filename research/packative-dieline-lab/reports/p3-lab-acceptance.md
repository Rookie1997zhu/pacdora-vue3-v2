# P3 — Lab Packative 验收报告（V1.2 / prompt 03）

日期：2026-11-12  
环境：Windows 10；本地 `pacdora-vue3-v2`；Vite preview `http://127.0.0.1:4173/lab`  
依据：`prompts/03_QA_and_Acceptance_Prompt.txt`；接线代码 `src/packative/` + `src/legacy/LegacyLab.vue`

## 主结论

**主线通过（Lab Packative 行为 + 回归）**；holdout/gates 对比见 [`p3-holdout-gates.md`](./p3-holdout-gates.md)。  
未做：扩其它盒型；旁路同批 SVG 归档；Compose 前端重新部署（本验收用 `npm run preview`）。  
`manufacturingReady`：**false**。

## 数量口径

| 指标 | 数量 |
|---|---:|
| Lab Packative 目录行 | 12 |
| validated | 9 |
| holdout | 1 |
| unvalidated | 2 |
| evidence_ref 覆盖 | 12 |
| 旁路真实库存（非 example） | 0 |

## 范围核对

| 项 | 结果 | 证据 |
|---|---|---|
| 三源分离 owned / imported / packative | 通过 | Lab 三 chip；路由 `/lab` |
| 未注入 knife/templates | 通过 | grep `packative|crashlock|generateCrashlock` 于 `src/knife.js` / `templates` 无命中 |
| 无拓扑不虚构 3D | 通过 | 工位「无拓扑 · 不提供 3D」；无 Three remount |
| 旁路非主成功标准 | 通过 | 本报告主结论仅 Lab Packative |

## Lab Packative（浏览器烟测）

| 检查项 | 结果 | 证据 |
|---|---|---|
| Packative 页签并列 | 通过 | preview：chip「Packative」与已有/运输箱并列 |
| crashlock 可选 | 通过 | 进 100×80×80；标题「纸质锁底盒（Crashlock）」；2D 原型 |
| 验证范围改尺寸 | 通过 | H 80→70；文案变为「原型回放 100×80×70 mm · 已验证」 |
| 越界禁止静默拉伸 | 通过 | H 尝试 50 后回退为 70；meta 仍为已验证 100×80×70 |
| holdout 只读 | 通过 | 100×80×90；L/W/H `disabled/readonly`；「Holdout 只读对照」 |
| unvalidated 阻断 | 通过 | 点 100×80×50 仍停留画廊，未进工位 |
| 仅 SVG 导出 | 通过 | 按钮「导出原型 SVG」；文案声明 DXF/PDF/AI/JSON 不可用 |
| i18n zh/ko | 通过 | 切 한국어：标题/导出/无 3D 文案为韩文 |
| 目录可追溯 | 通过 | catalog 行均含 `evidence_ref` |

## 命令与回归

| 命令 | 退出码 | 摘要 |
|---|---:|---|
| `npm run check:all` | 0 | topology/fold/contract/export/golden/templates/geom/outbox/net-masks 全过 |
| `npm run build` | 0 | Vite 生产构建成功；含 `LegacyLab` chunk |
| `node scripts/p3-holdout-compare.mjs` | 0 | 写出 `p3-holdout-gates.json`；research gates passed；full topology blocked |

旁路 Django 测试本轮 **未复跑**（记未运行；历史 Phase4 已通过，旁路为次要）。

## 未运行项

- Compose / Caddy 实机刷新前端 dist
- 旁路 `manage.py test` 本轮复测
- 付费/CDN 实时拉版（不在 P3 范围）

## 失败 / 修复

无阻断失败。已知非阻断差距：Lab 原型包络 `GEOM_*` 与研究台 OLS holdout 观测存在 uu 差（见 holdout 报告），不据此宣称包络模型已对齐。
