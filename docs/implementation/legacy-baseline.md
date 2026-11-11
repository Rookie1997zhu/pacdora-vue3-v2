# Legacy Baseline — 旧功能冻结清单

**基线提交**：`59ae1f8637f19cc655562bb2029fcb4fddcccd7f`  
**保全入口（P1）**：`/` 与 `/lab` → LegacyLab（原 `src/App.vue`）  
**原则**：新功能不得以删除下列能力换取页面整洁；匿名仍可使用本地工具。

## 目录与搜索

- 盒子 → 已有的刀版（结构分组）+ 导入的尺寸目录
- 导入运输箱：`src/catalog/presets.js` 声明 `count=47`、`byCategory.shipping=47`
- 稳定 ID（47）：`import-102040`、`import-102041`、`import-103020`、`import-103021`、`import-110171`、`import-110680`、`import-110810`、`import-112010`、`import-112470`、`import-112471`、`import-112480`、`import-112481`、`import-112511`、`import-116200`、`import-152102`、`import-153031`、`import-156090`、`import-156131`、`import-200010`、`import-200012`、`import-200013`、`import-200014`、`import-200015`、`import-200016`、`import-200017`、`import-200020`、`import-200030`、`import-200034`、`import-200035`、`import-200100`、`import-200102`、`import-200200`、`import-200210`、`import-200230`、`import-200240`、`import-200250`、`import-200280`、`import-201012`、`import-201013`、`import-201015`、`import-201080`、`import-201081`、`import-205010`、`import-205011`、`import-206080`、`import-20001001`、`import-20001002`
- 编号/名称搜索、细分类筛选

## 参数与材料

- 中韩切换（`vue-i18n` + localStorage）
- 内外尺寸、厚度、瓦楞方向、材料色板
- 高级参数、默认值重置、多件选择（模板 `piece`）
- `geomMode`：有几何快照时参数锁定（不得把 47 条全部宣称为任意尺寸可变）

## 2D / 3D

- 2D 刀版 + 图层开关（切/压/出血/尺寸标注）
- 缩放、视角重置
- 3D 折叠/平移顺序、孔洞、合盖示意（AABB）
- `productionReady=validation.ok`；`manufacturingReady` 恒 `false`
- `BLEED_EXTRA_MM=10`、cutApprox/bleedApprox、示意闭合 — 须保留并审阅，不得删 DEMO 冒充投产

## 导出

- JSON / SVG / DXF / PDF / AI（AI=PDF 兼容负载）
- 旧 PDF 为校样稿，非 1:1 mm→pt 生产链

## 外箱（outbox）

- grow / fixed 双模式
- 数量/容量、自动与手动 nx/ny/nz、水平旋转、间隙、利用率
- 错误提示、内物可见、外箱独立导出

## 自检脚本

`npm run check:all` → topology → fold → contract → export → golden → templates → rea-golden → catalog → geom-assembly → outbox

## GitHub Pages

保留静态演示构建；演示环境不得伪装云保存/AI/订单。
