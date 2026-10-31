# REA 严格反推记录 · Pacdora.cn 17 官方子类

> 日期：2026-10-29（补充批次已合入）  
> 范围：与 [REA_Aircraft_严格反推记录.md](./REA_Aircraft_严格反推记录.md) **同级**：REA 证明调用链 + 受控 `knife` 尺寸网格差分  
> 脚本：`data_search/_rea_strict_17cats_diff.py`（及 window / thickness / cancylinder / curvebox / knifeprototype）  
> 金样：`data_search/exports/formula_diff/rea_strict_17cats/` 等

---

## 0. 结论先行

1. **前端无结构公式**（全品类共用）：`knifeEffect` / `useModelPanel` 只 `GET /api/v2/project/knife`；几何由服务端再生。  
2. **`knife?id=` 必须用列表 id**（`/api/v2/models` 的 `id`，见 `pacdora_boxes_geom.csv` 的「列表id」）。**禁止**用 `modeCate.id` / `cateId`（会串型到错误结构）。  
3. 17 官方子类均已选定代表样并完成尺寸网格差分；**15/17** 全组 `req_equals_knife=true` 且 `code` 匹配；**食品盒/塑料盒**（`CanCylinder`）与 **KnifePrototype** 公开 LWH 覆盖**无效**（恒回默认尺寸）。  
4. **补充批次已完成**：开窗 bbox、Aircraft 薄卡分支、CanCylinder 负结论、CurveBox 入口、KnifePrototype 示意口径。  
5. 运行时仍 **不**加载第三方 cuts 点列；下列公式供 BOXCRAFT `generate()`。

---

## 1. REA 调用链（全类共用 Evidence）

与飞机盒记录相同，不重复抓包：

| Evidence | 结论 |
|----------|------|
| `knifeEffect-*.js` | `getProjectKnife` = `GET /api/v2/project/knife` + params |
| `useModelPanel-*.js` | 改尺寸 → 业务更新 → 再拉 knife |
| `pacdora-3d-*.js` | 无 Aircraft/Carton/Pair 等展开代数引擎 |

```http
GET /api/v2/users/experience_user
GET /api/v2/project/knife?id={列表id}&bleed=5&export_type=model&length={Lk}&width={Wk}&height={Hk}
```

---

## 2. 代表样与列表 id（严格差分锚点）

| 官方子类 | 代表 num | 列表 id | modeCate.code | 网格组数 | code+req 全过 |
|----------|----------|---------|---------------|----------|---------------|
| 方形盒 | 16101202 | 9411 | CoverBassetCardboardBox | 5 | ✓ |
| 礼盒 | 10201102 | 5721 | BuckleWithNailOne | 5 | ✓ |
| 邮寄盒 | 150010 | 1 | Aircraft | 5 | ✓（holes✓） |
| 运输箱 | 200010 | 3 | Carton | 5 | ✓ |
| 产品盒 | 100010 | 6 | Pair | 5 | ✓ |
| 食品盒 | 501202 | 8780 | CanCylinder | 5 | 仅默认尺寸可过 |
| 展示盒 | 17031101 | 9601 | MultiFunctionDisplayBox | 5 | ✓ |
| 折叠盒 | 150010 | 1 | Aircraft（=邮寄） | 3 | ✓（holes✓） |
| 套筒与托盘盒 | 128010 | 730 | Bufferwallbox | 5 | ✓ |
| 带窗的盒子 | 100014 | 138 | PairWithWindow | 5 | ✓ |
| 带手柄的盒子 | 112470 | 288 | RoofflatHandleBuckle | 5 | ✓ |
| 带盖盒 | 161012 | 529 | CoverBassetCardboardBox | 5 | ✓ |
| 挂盒 | 100020 | 13 | PairWithHook | 5 | ✓ |
| 插口盒 | 100010 | 6 | Pair（=产品） | 3 | ✓ |
| 多边形盒 | 184110 | 10600 | DoubleDoorLockBottomBoxP1 | 5 | ✓ |
| 塑料盒 | 501202 | 8780 | CanCylinder（=食品） | 3 | 仅默认尺寸可过 |
| 其他 | 105210 | 5450 | FullCoverSelfLockingTearFlatStickyBox | 5 | ✓ |

说明：

- **礼盒**：侧栏主频次 `KnifePrototype`（如 615305/list5700）**无 openParams**；严格差分改用可参数化代表 `BuckleWithNailOne`。`KnifePrototype` 仅尺寸驱动/示意。  
- **折叠盒 / 插口盒 / 塑料盒**：与邮寄 / 产品 / 食品 **同列表 id**，差分复用。

---

## 3. 分结构闭合公式（差分实证）

下列以刀版 `L,W,H`（=请求 length/width/height）为输入。自动比例拟合中易把**常数**误判为 `k*L`（如 `K=2`）；下表已人工校到可落地闭式。

### 3.1 Aircraft（邮寄盒 / 折叠盒）— list=1

```text
N  ≈ round(0.4*W) ;  SW ≈ round(0.2*W) ;  SP ≈ 2*SW ≈ 0.4*W
K  = 2
M  = H - 1.5 ;  DC = H + 1.5     # 默认板厚路径 D≈1.5
NX = NY = 3
H = L×W ;  FBL.w = N ;  FL.w = M ;  HL.w = DC
holes: margin=(W-((K-1)*SP+SW))/2 ; 左右槽深=bleed, h=SW
```

五组 holes bbox 全过。专文：[Aircraft_openParams_反推公式.md](./Aircraft_openParams_反推公式.md)

### 3.2 Carton（运输箱）— list=3

```text
F  = W/2 + 1
F1 = F + 2
G  ≈ 45（本组尺寸网格近似常数；更大尺寸需复核）
OF/R/GT 缓变（≈千分之几×L）
H/F : L×H ;  FR : W×H ;  HL.w = G
HT/HB/FT/FB : w=L , h=F
```

稳定面片恒等式五组一致。标签建议 `FEFCO:0201`。

### 3.3 Pair 族（产品盒 / 插口盒 list=6；挂盒 PairWithHook list=13；带窗 PairWithWindow list=138）

```text
管式骨架：H/F = L×H ; FR = W×H ; HL.w = G
默认粘舌：G≈16 , GT≈15（小盒网格近似常数；礼盒钉扣样随 H 缓变）
插锁/防尘：C≈0.14*L ; CR≈0.07*L ; A≈0.33*L ; ATT≈0.09*H
AX≈0.03*L ; AXX≈0.04*L ; NX=NY≈0.026*L
挂孔增量：PairWithHook 另有 AXX1≈0.009*L
开窗：PairWithWindow 同管式参数族 + 窗洞见下
```

**开窗（list=138）已闭合** → [PairWithWindow_开窗反推公式.md](./PairWithWindow_开窗反推公式.md)

```text
面 F 上 holes[0]：
  w = X2 ; h = Y4 ; x_rel = (L - X2)/2 ; y_rel = Y3 ; 倒角 XR
金样五组 all_checks_passed=true（rea_strict_window/）
```

### 3.4 CoverBassetCardboardBox（方形盒 list=9411；带盖盒 list=529）

```text
H = L×W ;  HT/HB = L×H
HTR/HTL : w = W1≈W/3 , h = H
OH ≈ 20（常数）;  TC 常≈15（小盒变体）
TD≈0.75*H（大盒样）或与 W 相关（小盒样）——生成器按变体分支
盖板 F 约 (L+余量)×(W+余量)，与厚度/收位相关
```

### 3.5 MultiFunctionDisplayBox（展示盒）— list=9601

```text
F = L×W ; FB = L×H ; FBL.w = N ; HT.h = C≈H-余量≈0.98*H
N≈0.24*L ; SW≈0.14*L ; SP≈2*SW ; L1≈0.2*L ; K≈2
```

holes 布局**不是** Aircraft 公式（本轮 `hole_check` 失败属预期）。

### 3.6 Bufferwallbox（套筒与托盘）— list=730

```text
F = L×W ; FL/FR : Hk×Wk
L5≈0.37*L ; G≈0.039*L ; SD/T1/GR/R1 小比例系数
```

两件套语义：托盘墙缓冲参数为主；袖套需另选 sleeve 代表补差分。

### 3.7 RoofflatHandleBuckle（带手柄）— list=288

```text
H/F = L×H ; HL.w = G ; HT.h = D1≈0.2*L
提手相关：BR/RY/Y/Y1 小倒角；C≈0.1*L ; CR≈0.05*L
```

### 3.8 DoubleDoorLockBottomBoxP1（锁底·非多边形）— list=10600

```text
H = L×H ; HL.w = W1≈0.16*L
N≈0.4*L ; SW=SW1≈0.2*L ; SP≈0.4*L ; N1≈0.2*L
```

**真多边形 / 曲线盒**另轨：`CurveBox` list `12109` → [CurveBox_多边形反推入口.md](./CurveBox_多边形反推入口.md)（`G=15`，`X≈0.1L`，`Y=X/2`，`WW=0.6W`…）。`StarBox*`（`W=0`）仍未闭极坐标。

### 3.9 BuckleWithNailOne（礼盒可参数路径）— list=5721

```text
与 Pair 钉扣/插锁参数同族；G/GT 随 H 比例更明显
面片：FL.h = H（本组稳定）
```

`KnifePrototype`（list `5700` / `615305`）：**无 openParams**；**LWH 覆盖无效**（恒回 184³）。工程口径：**仅示意 / 仅尺寸目录**，参数化礼盒挂钉扣或盖盒。金样：`rea_strict_knifeprototype/`。

### 3.10 FullCoverSelfLockingTearFlatStickyBox（其他）— list=5450

```text
H/F = L×H
G≈0.085*L ; F1≈0.32*L ; SP≈0.16*L ; ST/SL/SR/WW 撕口相关小系数
```

### 3.11 CanCylinder（食品盒 / 塑料盒）— list=8780

```text
本地 71 样：F = L×W 且 H=0；无 openParams
公开 knife：length/width/height / 其它探测 query·POST —— 覆盖均无效，恒回默认 100×95×0
```

探测摘要：`rea_strict_cancylinder/summary.json`（**负结论已归档**）。  
BOXCRAFT：圆柱展平**独立引擎** + 尺寸目录；不依赖 Pacdora LWH 再生。

### 3.12 Aircraft 板厚分支

见 [Aircraft_openParams_反推公式.md](./Aircraft_openParams_反推公式.md) §6.4；摘要 `rea_strict_aircraft_thickness/summary.json`。  
`D≥1`：离散 holes + `F.w=L−2*bleed`；薄卡：`holes=[]`，`F.w=L−2`，`M=H−0.5`。

---

## 4. 缺口收口表（补充计划）

| 项 | 状态 |
|----|------|
| PairWithWindow 窗 bbox | **已闭合** |
| Aircraft 薄卡 / 板厚 | **已闭合** |
| CanCylinder 公开再生 | **负结论**（独立引擎） |
| CurveBox 入口 | **已闭合面板+默认参**；Star 极坐标未做 |
| KnifePrototype | **示意级**（尺寸锁死） |

---

## 5. 对 BOXCRAFT 的含义

| 优先级 | 动作 |
|--------|------|
| P0 | `generateAircraft`（含 §3.12 材质分支）/ `generateCarton0201` / `generatePair*` |
| P1 | `generateTrayLid` + **PairWithWindow 窗** + Hook + Handle |
| P1 | Bufferwall / 展示 PDQ 示意 / `curveBoxPanel` |
| P2 | 双开门锁底 / 「其他」撕口盒 |
| P3 | KnifePrototype 示意；CanCylinder 独立；Star 极坐标 |

金样回归：`exports/formula_diff/rea_strict_17cats/{子类}/` 及下列补充目录。

---

## 6. 产物索引

| 路径 | 内容 |
|------|------|
| `exports/formula_diff/rea_strict_17cats/summary.json` | 总表 + 每类 formulas/idents |
| `exports/formula_diff/rea_strict_window/` | 开窗五组金样 |
| `exports/formula_diff/rea_strict_aircraft_thickness/` | 板厚分支 |
| `exports/formula_diff/rea_strict_cancylinder/` | 圆柱探测（负结论） |
| `exports/formula_diff/rea_strict_curvebox/` | CurveBox 入口 |
| `exports/formula_diff/rea_strict_knifeprototype/` | Prototype 示意确认 |
| [PairWithWindow_开窗反推公式.md](./PairWithWindow_开窗反推公式.md) | 开窗专文 |
| [CurveBox_多边形反推入口.md](./CurveBox_多边形反推入口.md) | 多边形分轨 |
| [REA_Aircraft_严格反推记录.md](./REA_Aircraft_严格反推记录.md) | 飞机盒 holes 级专文 |
| [BOXCRAFT_B1_参数化结构落地方案.md](./BOXCRAFT_B1_参数化结构落地方案.md) §11 | 落地映射 |
