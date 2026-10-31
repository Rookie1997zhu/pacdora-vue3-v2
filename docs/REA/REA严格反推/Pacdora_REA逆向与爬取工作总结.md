# Pacdora REA 逆向与爬取工作总结

> 日期：2026-10-29  
> 范围：本仓 `data search`（webspider）对 Pacdora 的接口逆向、Scrapy 采集与结构清单沉淀  
> 后续落地：见 [BOXCRAFT_B1_参数化结构落地方案.md](./BOXCRAFT_B1_参数化结构落地方案.md)

---

## 1. 方法

1. 用 **REA / 浏览器抓 XHR（CDP）** 确认公开接口与鉴权方式  
2. 再用 **Scrapy + 反爬中间件** 限速采集  
3. **禁止**在未验证接口前盲猜、盲打  

约定与项目内 `scrapy-crawler` / `pacdora-dieline-crawl` skill 一致。

---

## 2. 已确认的关键接口

| 用途 | 接口 | 要点 |
|------|------|------|
| 访客登录 | `GET /api/v2/users/experience_user` | 后续 knife 依赖 Cookie |
| 类目树 | `GET /api/v2/models/ctree?mockup=true` | Boxes：`nameKey=boxes`，`mockupNameKey=box-mockups` |
| 模型列表 | `GET /api/v2/models` | 翻页只用 `current`；**勿**同时传 `current>1` 与 `offset>0` |
| 材质 | `GET /api/v2/materials/science` | 用 `def_science_id` 映射 |
| 刀版几何 | `GET /api/v2/project/knife?id={列表id}&bleed=5&export_type=model` | `id` = 列表 id，**不是** `num` / `cateId` |

站点：`www.pacdora.com` / `www.pacdora.cn`（字段结构一致，目录 count 可能不同）。

### 查证结论（「新模板」）

- **没有**可下载的「公开结构新模板 JSON 目录」  
- Open API（需 appId/appKey）主要导出 **PDF / AI / DXF**，不是结构模板库  
- `/api/v2/templates` 为美工/贴图样，**不是** cuts/folds/`openParams` 工程结构库  
- 单模型几何原料仍来自 **`/project/knife`**（已落盘）

---

## 3. 采集成果

| 内容 | 结果 / 路径（相对 `data_search/`） |
|------|-------------------------------------|
| Boxes 列表与参数 | 约 **2033** 条 · `exports/pacdora_boxes.csv`、`pacdora_boxes_geom.csv`（及 xlsx） |
| 刀版几何 JSON | `exports/geometry/pacdora_boxes/{num}.json` |
| 刀版预览图 | `exports/images/pacdora_boxes/full/{num}.png`；CDN 空文件则 **SVG 兜底**，与编号对齐 |
| 官方子类结构清单 | `exports/structure_inventory/01`～`06_*`（csv/xlsx） |
| 未映射处置 | `suggestAction`：`可映射` / `需新模板` / `仅尺寸`（含公开展开+可矩形化标注） |

### 最小数据集（采集验收口径）

- 身份：`num`、列表 `id`、名称、`mockupNameKey`  
- 分类：官方子类、`modeCate.code/name/remarks`  
- 尺寸：`knifeSize` L/W/H、限制、`totalX/Y`  
- 几何：`layer.*.cuts/folds/faces/...`、`openParams`  
- 材质与刀版图：与 `{num}` 一一对应  

---

## 4. 工程沉淀

| 类型 | 位置 |
|------|------|
| 列表/参数 Spider | `data_search/spiders/pacdora_mockups.py` |
| 几何+图 Spider | `data_search/spiders/pacdora_boxes_geom.py` |
| 反爬中间件 | `PacdoraAntiBanMiddleware`（限速、UA、Referer、401 重登等） |
| 结构清单脚本 | `data_search/_build_box_structure_inventory.py` |
| 未映射标注脚本 | `data_search/_annotate_unmapped_suggest.py` |
| Agent Skill | `data search/.cursor/skills/pacdora-dieline-crawl/`（含 reference、新模板边界说明） |

### 踩坑与修复

- 分页：`current` 与 `offset>0` 同传会导致错位 → 翻页只增 `current`  
- 刀版图：部分 CDN 空 body → 用 cuts/folds 生成 SVG  
- knife 鉴权：无登录 → 401；需先 `experience_user`  

---

## 5. 对后续产品的定位

| 来源 | 用途 |
|------|------|
| 本仓 Pacdora 数据 | **只读参考**：尺寸目录、结构归类、离线反推参数公式 |
| BOXCRAFT LAB 网站 | **主开发**：自有参数模板 `generate()` + `mapTemplate` 重算 |
| FEFCO / ECMA | **代号标签**，不作为几何源 |

产品约定（与 Demo 一致）：

> 选中导入尺寸后用**自有模板重算**，**不加载**第三方刀版坐标。

详细排期与阶段见：[BOXCRAFT_B1_参数化结构落地方案.md](./BOXCRAFT_B1_参数化结构落地方案.md)

---

## 6. 常用命令（备查）

```bash
cd "data search/data_search"

# 几何 + 刀版图全量（boxes）
scrapy crawl pacdora_boxes_geom

# 仅参数试跑
scrapy crawl pacdora_mockups -a mockup_name_key=box-mockups -a download_knife=0 -a max_pages=1

# 结构清单（依赖已有 geometry + csv）
python _build_box_structure_inventory.py
```

---

## 7. 一句话

**REA 确认接口 → Scrapy 采齐盒子参数/几何/图与结构清单 → 确认无公开「新模板 JSON 包」→ 数据移交网站做 B1 自研参数化模板；本仓采集主线可收束。**
