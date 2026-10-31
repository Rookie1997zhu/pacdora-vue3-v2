# REA 严格反推记录 · Aircraft（150010）

> 日期：2026-10-29  
> 范围：Pacdora 前端 REA + 服务端 knife 差分验证  
> 结论先行：**Aircraft 刀线公式不在浏览器里**；前端只 `GET /api/v2/project/knife`，几何由服务端生成。严格反推 = REA 证明调用链 + 受控 API 差分闭合公式。

---

## 1. REA 做了什么（Evidence）

### 1.1 受控浏览器场景

工具：`user-rea.capture_browser_scenario`（launch Chrome headless）

| 场景 | 结果 |
|------|------|
| 打开 `mockup-detail/flip-top-boxes-mailer-mockup-150010` | 加载 UI 脚本（含 `knifeEffect`、`Calc`、`pacdora-3d`）；**未**在首屏自动打 knife |
| 点击 3D Design / Edit | 仍停在 mockup-detail；刀线 VIP 编辑未进入完整桌面刀版台 |

产物：`agent-tools` 场景 Evidence；脚本列表见  
`data_search/exports/formula_diff/rea_capture/script_urls.txt`

### 1.2 静态脚本结论（关键）

| 脚本 | REA 发现 |
|------|----------|
| [`knifeEffect-D0GpcW0EhQ.js`](../data_search/exports/formula_diff/rea_capture/js/knifeEffect-D0GpcW0EhQ.js) | `getProjectKnife` / `getKnife` = `GET /api/v2/project/knife` + `params`；**无本地生成路径** |
| [`useModelPanel-BPwUgmluTe.js`](../data_search/exports/formula_diff/rea_capture/js/useModelPanel-BPwUgmluTe.js) | 改尺寸后：`updateSizeProject` → 业务更新 API，再 `a({ bleed: bleedline, export_type: 'project', id })` 拉 knife |
| `pacdora-3d-*.js`（约 5.5MB） | **0 处** `Aircraft` / `Shake cover`；`openParams` 仅用于软包（`ZW/SP/G`）等渲染辅助，**不是**飞机盒展开公式引擎 |
| `Calc-*.js` | 用 `project.openParams` 判断是否 `advance` 埋点类型 |

**Predicate：** Aircraft 的 cuts/folds/holes/openParams 数值由 **服务端 knife** 产出；前端负责请求与渲染。

### 1.3 已确认的 knife 请求形态

```http
GET /api/v2/project/knife
  ?id={列表或项目id}
  &bleed={bleedline}
  &export_type=model|project
  &length={L}&width={W}&height={H}   # 可选；出现时即刀版 L/W/H
```

须先 `GET /api/v2/users/experience_user`。

REA 源：`knifeEffect` 的 `params:e`；`useModelPanel` 显式传入 `bleed` / `export_type` / `id`。  
`length/width/height` 由 API 差分 empirically 确认（见 §2），前端打包里未搜到与 Aircraft 绑定的字面组装（改尺寸链路部分在未导出的动态 chunk / 服务端）。

---

## 2. 严格差分（服务端再生）

脚本：`data_search/_rea_strict_aircraft_diff.py`  
输出：`exports/formula_diff/rea_strict_aircraft/summary.json` + 各组金样 JSON  

条件：`id=1`（150010 / Aircraft），`bleed=5`，`export_type=model`，五组 L/W/H。

| L×W×H | N | SW | SP | K | M | DC | holes 布局 | req=knife |
|-------|---|----|----|---|---|-----|------------|-----------|
| 300×200×60 | 80 | 40 | 80 | 2 | 58.5 | 61.5 | PASS | PASS |
| 250×180×50 | 72 | 36 | 72 | 2 | 48.5 | 51.5 | PASS | PASS |
| 400×250×80 | 100 | 50 | 100 | 2 | 78.5 | 81.5 | PASS | PASS |
| 200×230×58 | 92 | 46 | 92 | 2 | 56.5 | 59.5 | PASS | PASS |
| 315×202×62 | 81 | 40 | 80 | 2 | 60.5 | 63.5 | PASS | PASS |

**`summary.all_checks_passed = true`**

---

## 3. 闭合公式（在 §2 证据下）

设刀版尺寸 `L,W,H`（与请求 length/width/height 相同），默认板厚路径 `D≈1.5`（本组 API 响应表现）：

### 3.1 默认 openParams

```text
N  ≈ round(0.4 * W)          # W=202 → 81；整十则精确 0.4W
SW ≈ round(0.2 * W) 或 使 2*SW≈SP 的取整
SP ≈ 2 * SW                  # 五组均成立；亦 ≈ 0.4W（整十时）
K  = 2
M  = H - 1.5                 # = H - D（D=1.5）
DC = H + 1.5                 # = H + D
NX = NY = 3（本组默认恒定）
```

### 3.2 面片

```text
H.w = L , H.h = W
FBL.w = N   （及对称 FBR/HBL/HBR）
```

### 3.3 插孔 holes（左右 × K）

```text
span   = (K - 1) * SP + SW
margin = (W - span) / 2
depth  = bleed          # 请求 bleed=5 时槽宽=5

for i in 0..K-1:
  y = H.y + margin + i * SP
  左: (H.x, y, depth, SW)
  右: (H.x + L - depth, y, depth, SW)
```

五组 bbox 与公式逐点一致（见 summary 内 `got_boxes` / `exp_boxes`）。

---

## 4. 明确未由 REA 拿到的东西

| 项 | 状态 |
|----|------|
| 服务端源码 / 闭式代数引擎 | **无**（不在前端包） |
| 仅改 `N`/`K` 不改 LWH 的公开 API | **未暴露**（query 忽略；POST 不可用） |
| 完整 cuts 外轮廓逐段生成式 | 未符号化；可用金样回归，不阻塞 holes/面板 P0 |
| 薄卡 / 非默认 D 的 M·DC | 需另开差分（本地 `15001007` 显示 holes 可为空） |

---

## 5. 对 BOXCRAFT 的含义

1. **不要**指望从 Pacdora 前端「拷贝公式源码」——REA 证明没有 Aircraft 公式包。  
2. **可以**按 §3 自研 `generateAircraft`；用 `rea_strict_aircraft/*.json` 做回归。  
3. 运行时仍 **不加载** 第三方 cuts 点列；只使用反推公式。  

关联文档：

- [Aircraft_openParams_反推公式.md](./Aircraft_openParams_反推公式.md)  
- [BOXCRAFT_B1_参数化结构落地方案.md](./BOXCRAFT_B1_参数化结构落地方案.md) §11  
