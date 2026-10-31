# Aircraft（飞机盒 / 翻盖邮寄盒）openParams 反推公式

> 目标：B1 自研 `generate()`，**不**把 Pacdora cuts/folds 坐标载入 BOXCRAFT 运行时。  
> 试点结构：`modeCate.code = Aircraft`，代表样 `150010`（及同 code 变体 `15001004/06/07…`）。  
> 方法：**REA 证明公式在服务端** + 受控 `knife` 差分闭合（见 [REA_Aircraft_严格反推记录.md](./REA_Aircraft_严格反推记录.md)）。  
> 数据：`geometry/pacdora_boxes/` + `exports/formula_diff/rea_strict_aircraft/`

---

## 1. 关键结论

1. `/api/v2/project/knife` 返回的 `openParams` 只有 `name/value/min/max/unit/description/grade`，**没有** `formula`/`expr`。  
2. 改尺寸/参数后几何由 **Pacdora 结构引擎重新生成**；本仓已存的是「某一组参数下的结果快照」。  
3. 反推可行路径：用多样本把 **openParams ↔ 面片 w/h ↔ knife L/W/H/厚度** 打成恒等式，再在 BOXCRAFT 自写生成器。  
4. `modeCate.advancedParamConfig` 给出参数分组（角部折翼 / 插脚插孔 / 内侧壁 / 盒盖侧翼 / 前盖侧翼），便于做 UI 与 `mapTemplate`。

---

## 2. 尺寸三层含义

以 `150010` 默认样为例（E-flute，`D=1.5`）：

| 层 | 字段 | 示例 |
|----|------|------|
| 内尺寸 | `size` | L=300, W=200, H=60, D=1.5 |
| 刀版尺寸 | `knifeSize` | L=315, W=202, H=62 |
| 外廓 | `outSize` | L=316, W=204.5, H=63 |

`getKnifeSizeAdd`（系数，非最终毫米）：

```json
{
  "L": {"id": "2", "ed": "0", "of": "0", "d": "0", "sd": "2"},
  "W": {"id": "2", "ed": "0", "of": "0", "d": "0", "sd": "0"},
  "H": {"id": "2", "ed": "0", "of": "0", "d": "0", "sd": "0"}
}
```

### 已验证的内→刀版增量（多样本）

| 厚度 D | ΔW (`knife-size`) | ΔH | ΔL |
|--------|-------------------|----|----|
| 1.5（瓦楞） | +2 (= D+0.5) | +2 (= D+0.5) | +15（未完全拆成闭式） |
| 0.42（薄卡） | +0.5 | +0.5 | ≈+3.34 |

**BOXCRAFT 建议：** 导入目录若已是刀版 L/W/H（如 315×202×62），直接当 `Lk,Wk,Hk`；若是净空内尺寸，先按材质厚度套用上表经验式或沿用站点换算后再生成。

下文面板公式一律以 **刀版 `Lk,Wk,Hk`** 与 **厚度 `D`**、**openParams** 为输入。

---

## 3. openParams 词典（Aircraft）

来自 `150010` + `advancedParamConfig` 分组：

### grade≈2 · 角部折翼 / 插脚插孔

| code | 样例值 | 含义（中/英） | 几何落点 |
|------|--------|---------------|----------|
| N | 81 | 摇盖/防尘翼宽 Shake cover | `FBL/FBR/HBL/HBR.w = N` |
| NX | 3 | 开槽厚 X | 底翼槽深相关；参与 `D2` |
| NY | 3 | 开槽厚 Y | `HL.h ≈ Wk - NY`（厚板样） |
| R | 1.5 | OF 倒角 | 盖折处圆弧半径 |
| K | 2 | 插孔数量 | 底面两侧锁孔组数 |
| SW | 40 | 插孔长 | `sizeArrowData` 标注 |
| SP | 80 | 孔距 | 孔中心间距 |
| SW1 | 39 | 插脚下宽 | 插舌根部宽 |
| CR | 2.5 | 插孔倒角 | 孔角圆弧 |

### grade≈3 · 内侧壁 / 倒角

| code | 样例值 | 含义 | 几何落点 |
|------|--------|------|----------|
| SX | 1.5 | X 收位 | 多处 `H - SX`、`DC` 相关 |
| D2 | 59.75 | 插脚深 | ≈ `DC - NX - SX/2`（厚板样验证） |
| DC | 63.5 | 内墙总高 | `HL/HR.w = DC` |
| R1 | 1 | 倒角 | FB 与侧翼过渡 |
| R2 | 1.5 | 倒角2 | FR/FL 与主体过渡 |

### grade≈4 · 盒盖侧翼

| code | 样例值 | 含义 | 几何落点 |
|------|--------|------|----------|
| M | 60.5 | 侧翼宽 Sub-side | `FL/FR.w = M`；`HB.h = M` |
| MT / MT1 | 20° | 侧翼斜角 | FL/FR 斜边角度 |
| MR | 15 | 侧翼倒角半径 | FL/FR 外端圆弧 |

### grade≈5 · 前盖侧翼

| code | 样例值 | 含义 | 几何落点 |
|------|--------|------|----------|
| TRH | 52 | 最高点 | `FTL/FTR.w = TRH` |
| TRR | 13 | 小倒角 | 前盖翼圆弧 |

默认经验（可作初值，仍受 min/max 约束）：

- `M ≈ Hk - SX`（厚板：60.5 = 62 - 1.5）  
- `N ≈ 0.4 * Wk`（`15001004`：0.4×230=92 精确；`150010`：0.4×202≈80.8≈81）  
- `DC` 略大于 `Hk`（内墙含插合余量）  
- `D2 ≈ DC - NX - SX/2`

---

## 4. 主面板尺寸恒等式（已多样本验证）

令刀版尺寸 `Lk,Wk,Hk`，厚度 `D`，出血 `bleed`（样例常为 5）。

| 面 | w | h | 验证 |
|----|---|---|------|
| **H**（底） | `Lk` | `Wk` | ✓ |
| **FB / FT**（前/后墙高向） | ≈`Lk` 或 `Lk` 微调 | `Hk` | FT.h=`Hk` ✓ |
| **L / R** | `Hk` | `Wk` | ✓ |
| **LL / RR** | `bleed`（例 5） | `Wk` | 厚板 ✓ |
| **F**（盖板） | 厚板：`Lk - 2*bleed`；薄卡另议 | `Wk + D` | 厚板 ✓；薄卡 `15001007` 为 `Lk-2` |
| **FL / FR** | `M` | `F.h` (=`Wk+D`) | ✓ |
| **FBL / FBR / HBL / HBR** | `N` | `Hk` 或 `M` | 宽=N ✓ |
| **HB** | `Lk` | `M` | ✓ |
| **HL / HR** | `DC` | ≈`Wk - NY` 或 `Wk - 2*SX` | 厚板 ✓ |
| **FTL / FTR** | `TRH` | ≈`FT.h - SX` 量级 | 宽=TRH ✓ |

### 展开包络（`150010`）

- `totalX ≈ 576`，`totalY ≈ 590`  
- 粗算：`totalX ≈ DC + bleed + Hk + Lk + Hk + bleed + DC`（两侧内墙+侧板+底）  
- `totalY ≈ FT.h + F.h + FB.h + H.h + HB.h`（盖→前→底→后摇盖链）

精确包络应对面片 `x,y,w,h` 取并集；自研生成器按面片定位累加更稳。

---

## 5. 拓扑（面片邻接 / 折线名）

主折线（`folds[].name`）示意：

```text
        FTL -- FT -- FTR
               |
        FL --- F --- FR
               |
        FBL -- FB -- FBR
               |
   HL-LL-L -- H -- R-RR-HR
               |
        HBL -- HB -- HBR
```

关键折线：`F_FT` `F_FL` `F_FR` `FB_F` `H_FB` `H_HB` `H_L` `H_R` `L_LL` `LL_HL` `R_RR` `RR_HR` `FT_FTL` `FT_FTR` `FB_FBL` `FB_FBR` `HB_HBL` `HB_HBR`。

底面 `H` 插孔见 **§6**（已用尺寸网格 + 多样本差分闭合）。

---

## 6. 底面插孔 holes 公式（已闭合）

样本：本地 `150010/04/06` + API 尺寸网格 `exports/formula_diff/aircraft_size_grid/`（`length/width/height` 重算）。

### 6.1 默认 openParams（随刀版 W 缩放）

在 API 用 `length/width/height` 指定刀版尺寸时（见 §7），**REA 严格差分五组**（`rea_strict_aircraft/summary.json`，`all_checks_passed=true`）默认：

```text
N  ≈ round(0.4 * Wk)
SW ≈ round(0.2 * Wk)     # 且 SP = 2*SW
SP = 2 * SW              # 整十宽时亦 = 0.4*Wk = N
K  = 2
M  = Hk - 1.5            # 本组默认 D≈1.5
DC = Hk + 1.5
NX = NY = 3
SW1 ≈ SW - 1（本地金样）
CR = 2.5（厚板样）
```

### 6.2 孔位几何（相对底面 H）

令 `H` 原点 `(Hx, Hy)`，尺寸 `Lk × Wk`，出血/槽深 `bleed`（请求里常为 5；厚板样槽宽 bbox 亦为 5，且 `2*D+2=5` 当 D=1.5）。

```text
span   = (K - 1) * SP + SW
margin = (Wk - span) / 2

对 i = 0 .. K-1:
  y_i = Hy + margin + i * SP
  左侧孔: x = Hx,              w = bleed, h = SW
  右侧孔: x = Hx + Lk - bleed, w = bleed, h = SW
```

验证：

| 样本 | margin | first_rel_y | centerΔy | SP | hole.h |
|------|--------|-------------|----------|-----|--------|
| 150010 W=202 | 41 | 41 | 80 | 80 | 40=SW |
| API 300×200×60 | 40 | 40 | 80 | 80 | 40 |
| API 250×180×50 | 36 | 36 | 72 | 72 | 36 |
| API 400×250×80 | 50 | 50 | 100 | 100 | 50 |

另：`holes.length == 2*K`（左右各 K 个）。薄卡样见 **§6.4**（`holes=[]`）。

### 6.3 孔轮廓形状

bbox 为轴对齐矩形；实际路径带 `CR` 圆角（`H.dlist` 上 `rx=ry=CR` 的 A 段）。自研 P2 可用：矩形槽 + 四角/槽口圆弧半径 `CR`。

### 6.4 板厚 / 薄卡分支（本地多样本已闭合）

> Evidence：本地同 code `Aircraft` 几何（公开 knife **无**材质切换参数）。摘要：`exports/formula_diff/rea_strict_aircraft_thickness/summary.json`。

| 分支 | 代表 | D | M | DC | SX | CR / R | holes | F.w | F.h |
|------|------|---|---|----|----|--------|-------|-----|-----|
| 瓦楞厚板 | `150010` 等×5 | 1.5 | `H−D` | `H+D` | `D` | 2.5 / 1.5 | `2*K` 离散孔 | `L−2*bleed`（bleed=5→`L−10`） | `W+D` |
| 薄卡 | `15001007/08/09` | 0.42 | `H−0.5` | `H+1.5` | ≈`D`(0.4) | 0.5 / 0.4 | **空**（并入 cuts） | `L−2` | `W+D` |

BOXCRAFT 可编码规则：

```ts
if (D >= 1.0) {
  // flute branch
  M = H - D; DC = H + D; SX = D; CR = 2.5; R = D;
  F.w = L - 2 * bleed; F.h = W + D;
  // emit holes per §6.2
} else {
  // thin board branch
  M = H - 0.5; DC = H + 1.5; SX ≈ D; CR = 0.5; R ≈ D;
  F.w = L - 2; F.h = W + D;
  holes = []; // lock geometry in outline only
}
```

---

## 7. 尺寸重算 API（已确认）

```http
GET /api/v2/project/knife?id=1&bleed=5&export_type=model&length={Lk}&width={Wk}&height={Hk}
```

- 须先 `experience_user`；`id=1` 对应型号 `150010` / Aircraft。  
- **`length/width/height` 即刀版 L/W/H**（`knifeSize` 与请求一致，`req_is_knife=true`）。  
- 服务端按默认 openParams 规则重出整包几何（faces/folds/cuts/holes）。  
- 单独改 `N`/`K` 的 query/POST **未打通**（忽略或 404/500）；改高级参数目前靠尺寸网格差分 + 本地多样本。

探测脚本：`data_search/_probe_knife_params.py`、`_fetch_aircraft_size_grid.py`、`_diff_aircraft_params.py`。

---

## 8. BOXCRAFT 自研 generate 建议接口

```ts
type AircraftParams = {
  Lk: number; Wk: number; Hk: number; D: number; bleed?: number;
  N: number; NX: number; NY: number; M: number; DC: number; D2: number;
  SX: number; TRH: number; TRR: number; MT: number; MT1: number; MR: number;
  R: number; R1: number; R2: number; CR: number;
  K: number; SW: number; SP: number; SW1: number;
};

function generateAircraft(p: AircraftParams): {
  faces: Array<{ name: string; w: number; h: number; x: number; y: number }>;
  folds: Array<{ name: string; x1: number; y1: number; x2: number; y2: number }>;
  holes: Array<Array<{ mtd: string; x: number; y: number; rx?: number; ry?: number }>>;
}
```

默认参数可先用：

```ts
N = 0.4 * Wk; SW = 0.2 * Wk; SP = 0.4 * Wk; K = 2; bleed = 5;
```

**P0：** 面片矩形框 + 折线骨架 + 尺寸标注。  
**P1：** FL/FR 斜角（MT）与圆弧（MR/R/TRR）。  
**P2：** 底面插孔按 §6 生成（bbox + CR）——**公式已备齐**。

---

## 9. 未闭合项

| 项 | 状态 |
|----|------|
| openParams→主面片 w/h | **已实证**（§3–§4） |
| holes / 默认 N·SW·SP | **已实证**（§6） |
| `length/width/height` 重算 | **已确认**（§7） |
| 内尺寸→刀版 ΔL（瓦楞默认 +15） | **半开**：与 `getKnifeSizeAdd`+厚度相关 |
| 薄卡 `F.w` / 空 holes / M·DC | **已闭合**（§6.4 材质分支） |
| 任意 openParam 覆盖（只改 N 不改尺寸） | API 未暴露；可用本地多样本近似 |
| cuts 外轮廓逐段公式 | 仍可用金样回归；非阻塞 P0/P2 |

---

## 10. 合规与产品边界

- 本文用于 **自研参数模板** 对照，不把 Pacdora 原始 `cuts/folds` 点列作为 BOXCRAFT 运行时数据源。  
- 已采 / 网格 JSON 仅作工程反推与回归金样。  

---

## 11. 参考文件

- 金样：`exports/geometry/pacdora_boxes/150010.json`  
- 同结构：`15001004.json`、`15001006.json`、`15001007.json`  
- 板厚分支：`exports/formula_diff/rea_strict_aircraft_thickness/summary.json`  
- 差分摘要：`exports/formula_diff/aircraft_param_diff.md`  
- 尺寸网格：`exports/formula_diff/aircraft_size_grid/`  
- 落地方案：[BOXCRAFT_B1_参数化结构落地方案.md](./BOXCRAFT_B1_参数化结构落地方案.md)  
- 采集 skill：`.cursor/skills/pacdora-dieline-crawl/`
