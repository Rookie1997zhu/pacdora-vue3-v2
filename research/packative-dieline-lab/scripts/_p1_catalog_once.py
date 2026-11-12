import csv
import json
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
repo = root.parents[1]  # pacdora-vue3-v2
inv = json.loads((root / "reports" / "p1-sample-inventory.json").read_text(encoding="utf-8"))
out_dir = repo / "docs" / "packative_lab_catalog"
out_dir.mkdir(parents=True, exist_ok=True)

rule_version = "research/packative-dieline-lab/data/rules/validated-rules.json@2026-11-12"
evidence_rea = "research/packative-dieline-lab/reports/p1-rea-ko-session.md"
evidence_inv = "research/packative-dieline-lab/reports/p1-sample-inventory.json"

# Catalog rows: validated + holdout only (no silent stretch of missing)
rows = []
baseline = "100x80x80"
for item in inv["planned_items"]:
    status = item["validation_status"]
    if status not in ("validated", "holdout", "local_unvalidated"):
        continue
    # Prefer validated/holdout for Lab draft; include local_unvalidated cross-scale with explicit status
    key = item["key"]
    rows.append(
        {
            "template_id": "productbox-crashlock",
            "title_zh": "纸质锁底盒（Crashlock）",
            "title_ko": "종이 단상자 (크래시락)",
            "L_mm": item["L"],
            "W_mm": item["W"],
            "H_mm": item["H"],
            "dimension_basis": "inner",
            "validation_status": "holdout" if status == "holdout" else ("validated" if status == "validated" else "unvalidated"),
            "rule_or_geom_version": rule_version,
            "evidence_ref": f"{evidence_rea}; {evidence_inv}; {item['local']['normalized_path'] if item.get('local') else ''}",
            "default_flag": key == baseline,
            "sample_group": item["group"],
            "product_page": "https://packative.com/products/productbox-crashlock/prod_01HRQ7914HA85GC0S44N63A3AF",
            "cdn_template": "https://studio-cdn.packative.com/{tenant}/dielines/productbox-crashlock/{L}_{W}_{H}/dieline.svg",
        }
    )

# Deduplicate by LWH (planned may repeat holdout keys across groups)
uniq = {}
for r in rows:
    k = (r["L_mm"], r["W_mm"], r["H_mm"])
    prev = uniq.get(k)
    if prev is None:
        uniq[k] = r
    else:
        # prefer validated over unvalidated; keep holdout label
        rank = {"validated": 2, "holdout": 2, "unvalidated": 1}
        if rank.get(r["validation_status"], 0) >= rank.get(prev["validation_status"], 0):
            if prev["validation_status"] == "holdout" or r["validation_status"] == "holdout":
                r["validation_status"] = "holdout" if k == (100, 80, 90) else r["validation_status"]
            uniq[k] = r

final_rows = sorted(uniq.values(), key=lambda r: (0 if r["default_flag"] else 1, r["L_mm"], r["W_mm"], r["H_mm"]))

catalog = {
    "schema_version": "1.0",
    "source": "packative",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "locale_observed": "ko",
    "notes": [
        "Draft catalog for Lab wiring (P2). Not presets.js yet.",
        "dimension_basis=inner from KO product page copy (박스 내부 사이즈).",
        "Do not claim original-asset library; this is size/geom parameter catalog.",
    ],
    "assets": final_rows,
}

(out_dir / "packative_catalog.json").write_text(
    json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

fieldnames = [
    "template_id",
    "title_zh",
    "title_ko",
    "L_mm",
    "W_mm",
    "H_mm",
    "dimension_basis",
    "validation_status",
    "rule_or_geom_version",
    "evidence_ref",
    "default_flag",
    "sample_group",
    "product_page",
    "cdn_template",
]
with (out_dir / "packative_catalog.csv").open("w", encoding="utf-8-sig", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=fieldnames)
    w.writeheader()
    for r in final_rows:
        w.writerow(r)

readme = """# Packative Lab 目录草案（P1）

对齐 Pacdora `docs/pacdora_shipping_boxes` 精神：参数/规格目录，**不是**固定资产原件库。

- 现行方案：V1.2 Packative → Lab
- 首盒型：`productbox-crashlock`
- 观察：`research/packative-dieline-lab/reports/p1-rea-ko-session.md`（韩语站）
- 盘点：`research/packative-dieline-lab/reports/p1-sample-inventory.*`

## 文件

| 文件 | 说明 |
|---|---|
| `packative_catalog.json` | 机器可读目录 |
| `packative_catalog.csv` | 同构表格 |

## 字段

template_id / title_zh / title_ko / L_mm / W_mm / H_mm / dimension_basis(=inner) / validation_status / rule_or_geom_version / evidence_ref / default_flag

## 下一步（P2）

Lab 第三源读取本目录；改尺寸仅 `validated`（`holdout` 只读对照）；禁止写入 `knife.js` 冒充自有引擎。
"""
(out_dir / "README.md").write_text(readme, encoding="utf-8")
print("rows", len(final_rows))
for r in final_rows:
    print(r["validation_status"], r["L_mm"], r["W_mm"], r["H_mm"], "default" if r["default_flag"] else "")
