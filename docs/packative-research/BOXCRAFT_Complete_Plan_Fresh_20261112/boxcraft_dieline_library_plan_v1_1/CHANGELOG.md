# 方案包修订记录

日期：2026-11-12。

## V1.2（现行）

13. **目标切换**：主线改为 **Packative REA → 参数/几何目录 → Lab**（对齐 Pacdora）；V1.1「现成固定规格刀版素材库」降为旁路。
14. 新增现行正文：`BOXCRAFT_Packative_Lab_Catalog_Plan_V1.2_2026-11-12.md`；V1.1 MD/HTML **保留只读历史**；HTML 不强制同步 V1.2。
15. 重写 `prompts/00`–`04`：主交付 = Lab Packative 源；固定库/`dieline_library` 标旁路；纠偏「勿再只做固定 SVG 囤货」。
16. 同步 `docs/dieline-library/`（DECISIONS / GAP / CHECKLIST / ACCEPTANCE / README）口径。
17. 标明 Cursor 历史 plan（dieline_library phase1–4、`packative_online_runtime`）对应 V1.1 固定库阶段，**已被 V1.2 取代为实施主线**；旁路代码可继续复用归档。

## V1.1（历史）

1. 将产品与实施范围从混用项目名改为仅 BOXCRAFT；明确排除 PackFlow。
2. 新增本地工作区优先规则，不 clone/pull、不覆盖未提交修改。
3. 依据仓库文件增加复用约束：catalog/assets/designs/exports、`/api/v1/`、Compose、私有媒体。
4. 区分固定原始刀版素材、现有尺寸目录、自有参数化引擎；禁止第三方几何注入自有引擎冒充。
5. 保留 Caddy 托管 Vue dist；不全仓改写 JS 为 TS。
6. 修正提示词边界；新增 04 纠偏提示词。
7. 保留通用数据契约 1.0、授权与制造验证要求；未编造采集结果。
8. HTML/Markdown/README/提示词同步（V1.1 当时）。
9. 采集停止/绕过禁令改为按任务策略记录处理。
10. Packative 适配器默认 `enabled=true`，永久许可；显式 disabled 仅供门禁测试。
11. 在线采集由 **REA + Scrapy** 配合，再交确定性队列。
12. 落地 Packative CDN crashlock 运行时；消除 `ONLINE_RUNTIME_UNAVAILABLE`；真网需 `--live`。（V1.2 起视为**旁路归档能力**，非 Lab 主线完成标志。）
