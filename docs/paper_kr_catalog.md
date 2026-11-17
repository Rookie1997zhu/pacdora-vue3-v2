# 韩国常用纸种目录（第 0 期）

> 代码源：[`src/catalog/paperCatalog.js`](../src/catalog/paperCatalog.js)  
> 用途：Studio 纸种选择 → 映射引擎 `materialId`（kraft/white/blue）+ `thicknessMm`。

## 调研摘要（首批）

| 韩文常见称呼 | 中文 | 类型 | 典型规格 | 默认厚度 mm | 引擎材质 |
|---|---|---|---|---|---|
| 크라프트 | 牛皮纸 | kraft | 150 / 250 / 350 g | 0.22 / 0.35 / 0.48 | kraft |
| 아트지 | 铜版/艺术纸 | art | 150 / 250 / 350 g | 0.18 / 0.30 / 0.42 | white |
| 백판지 | 白卡 | art | ~300 g | 0.40 | white |
| 블루보드 | 蓝卡 | art | ~300 g | 0.40 | blue |
| E골 | E 楞瓦楞 | flute | E | 1.5 | kraft |
| B골 | B 楞瓦楞 | flute | B | 2.8 | kraft |

说明：克重→厚度为预览用近似值，非印刷厂精确标定。瓦楞厚度取常见 E/B 单层量级。

## 商用贴图包（后续可替换）

当前 3D 预览使用 `public/materials/` 下 ambientCG：

- 牛皮 / 瓦楞预览：`Cardboard002_1K-JPG`
- 白卡 / 艺术纸 / 蓝卡：`Paper001_1K-JPG`（蓝卡靠 tint + 更低 roughness 区分）

购入商用纸材质感包后，将贴图放入 `public/materials/<pack>/`，并改 [`src/boardMaterial.js`](../src/boardMaterial.js) 的 `SPECS` 路径即可，无需改引擎。

## AI 生图开通（验收）

1. 管理台 **Console → AI**：配置 `provider`（如 `gemini` / `openai`）与 API Key，保存。  
2. 或 Compose/`deploy/.env`：`AI_PROVIDER=...`、`AI_API_KEY=...`（DB 配置优先覆盖 env）。  
3. Studio 左侧 **AI** 面板：`GET /api/v1/ai/capabilities/` 可用后可生图；未配置时显示「AI 不可用：未配置 provider/密钥」，不伪造成功。
