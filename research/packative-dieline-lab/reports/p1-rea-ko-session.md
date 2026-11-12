# P1 REA 韩语会话观察（crashlock）

日期：2026-11-12  
工具：Cursor IDE Browser（accessibility snapshot + CDP `Runtime.evaluate`）；CDN 探针用 Python `urllib`  
`paid_actions=false`：未点장바구니/바로 주문；未上传设计；未付费导出。

## 会话

| 项 | 观察 |
|---|---|
| 语言 | `한국어`（combobox value `ko`） |
| 登录 | 已登录；`/account/profile` 显示「안녕하세요, 김민준님」 |
| 登录方式 | 用户侧 Kakao（本会话打开 `/login` 后已进마이페이지，未再点 Kakao 按钮） |

## 产品入口

| 项 | 值 |
|---|---|
| URL | `https://packative.com/products/productbox-crashlock/prod_01HRQ7914HA85GC0S44N63A3AF` |
| 标题 | 종이 박스 - 단상자 \| 패커티브 |
| 模板标识 | `productbox-crashlock`（路径段） |
| Medusa product id | `prod_01HRQ7914HA85GC0S44N63A3AF` |
| 英文对照 | `https://packative.com/en/products/productbox-crashlock` |

## 尺寸字段（사이즈 직접 입력）

切换 radio **사이즈 직접 입력** 后出现：

| UI 标签 | 默认值 | 映射 |
|---|---|---|
| 가로(mm) | 100 | L |
| 세로(mm) | 80 | W |
| 높이(mm) | 80 | H |

标准模式：

- radio **표준 사이즈**
- 预设示例：`PR019 ( 55 x 55 x 75 mm )`
- 文案：**박스 내부 사이즈** → 尺寸口径记为 **inner**（页面明示内尺寸；公差说明 ±5%）

## 刀版下载入口（UI）

- **전개도 파일 다운로드**（设计用展开图下载；本轮未点击，避免与付费/订单流混淆）
- **작업 가이드 파일**

## 与 whitelist / CDN 契约对照

[`config/collect-whitelist.json`](../config/collect-whitelist.json)：

- `product` = `productbox-crashlock`：**一致**
- `cdn_template` = `https://studio-cdn.packative.com/{tenant}/dielines/{product}/{L}_{W}_{H}/dieline.svg`
- 本轮匿名 GET `.../100_80_80/dieline.svg` → **HTTP 200**，body 含 `<svg`，非 AccessDenied

### 路径分流（重要）

| 路径 | 是否需登录 | 用途 |
|---|---|---|
| 韩语产品页参数 UI（가로/세로/높이） | 本会话在已登录态观察；登录墙存在 | 参数口径与预设 PR 码 |
| studio-cdn `dieline.svg` | **可匿名**（至少 baseline 规格） | 研究台多样本 / 规则差分 |

二者勿混为一谈：UI 下载按钮 ≠ CDN 固定路径；参数研究以 CDN 样本 + 页面口径为准。

## 未知 / 未做

- 未枚举全部标准 PR 预设列表（下拉未全展开）
- 未验证「전개도 파일 다운로드」返回格式是否等同 CDN SVG
- 未进 Mockup Studio / EngView 3D
- tenant UUID 仍沿用研究台本地 meta（`ee4e06e4-...`），本页 HTML 未直接展示 tenant

## 结论

韩语站 crashlock 产品页字段与研究台 L/W/H mm、内尺寸口径、CDN 产品码一致；足够支撑 P1 目录草案。P2 Lab 接线可复用本报告 + `docs/packative_lab_catalog/`。
