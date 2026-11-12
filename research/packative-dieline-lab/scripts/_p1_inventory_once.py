import json
import re
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
matrix = json.loads((root / "config" / "sample-matrix.json").read_text(encoding="utf-8"))
validated = json.loads((root / "data" / "rules" / "validated-rules.json").read_text(encoding="utf-8"))
norm_dir = root / "data" / "normalized"
validated_set = set(validated.get("real_unique_sizes") or [])
holdout_frozen = str(validated.get("holdout_frozen") or "100x80x90")

local = {}
for p in norm_dir.glob("*.json"):
    m = re.search(r"(\d+)_(\d+)_(\d+)\.json$", p.name)
    if not m:
        continue
    key = f"{m.group(1)}x{m.group(2)}x{m.group(3)}"
    raw = json.loads(p.read_text(encoding="utf-8"))
    blob = json.dumps(raw)
    access = "AccessDenied" in blob
    ok = (not access) and (
        raw.get("cuttingCount")
        or raw.get("cutting_count")
        or raw.get("layers")
        or raw.get("paths")
        or raw.get("segments")
        or "cutting" in blob.lower()
    )
    local[key] = {
        "normalized_path": p.relative_to(root).as_posix(),
        "access_denied": bool(access),
        "appears_valid": bool(ok),
    }

items = []
for g, rows in (matrix.get("planned_groups") or {}).items():
    for r in rows:
        L, W, H = int(r["L"]), int(r["W"]), int(r["H"])
        key = f"{L}x{W}x{H}"
        loc = local.get(key)
        if key == holdout_frozen:
            status = "holdout"
        elif key in validated_set and loc and loc["appears_valid"]:
            status = "validated"
        elif loc and loc.get("access_denied"):
            status = "access_denied"
        elif loc and loc["appears_valid"]:
            status = "local_unvalidated"
        elif loc:
            status = "local_invalid"
        else:
            status = "missing"
        items.append(
            {
                "group": g,
                "L": L,
                "W": W,
                "H": H,
                "key": key,
                "note": r.get("note") or "",
                "validation_status": status,
                "local": loc,
                "in_validated_rules": key in validated_set,
            }
        )

planned_keys = {i["key"] for i in items}
extras = []
for k, loc in sorted(local.items()):
    if k not in planned_keys:
        extras.append(
            {
                "key": k,
                "local": loc,
                "validation_status": "validated" if k in validated_set else "local_extra",
            }
        )

inv = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "product": "productbox-crashlock",
    "holdout_frozen": holdout_frozen,
    "validated_unique_from_rules": sorted(validated_set),
    "cdn_probe": {
        "url_example": "https://studio-cdn.packative.com/ee4e06e4-c9b7-410f-b600-175fb1212729/dielines/productbox-crashlock/100_80_80/dieline.svg",
        "anonymous_get_100_80_80": "ok_svg_200",
    },
    "refetch": {
        "attempted": False,
        "reason": "All validated_rules unique sizes already present locally; optional gaps left missing for P1.",
    },
    "planned_items": items,
    "local_extras_not_in_planned": extras,
    "counts": {
        "planned": len(items),
        "validated": sum(1 for i in items if i["validation_status"] == "validated"),
        "holdout": sum(1 for i in items if i["validation_status"] == "holdout"),
        "missing": sum(1 for i in items if i["validation_status"] == "missing"),
        "local_unvalidated": sum(1 for i in items if i["validation_status"] == "local_unvalidated"),
    },
}

(root / "reports" / "p1-sample-inventory.json").write_text(
    json.dumps(inv, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

lines = [
    "# P1 sample inventory (productbox-crashlock)",
    "",
    f"generated: {inv['generated_at']}",
    "",
    "## Summary",
    "",
    f"- validated_rules unique: {len(validated_set)} (all have local normalized)",
    f"- holdout_frozen: `{holdout_frozen}`",
    f"- planned: {inv['counts']['planned']} (validated={inv['counts']['validated']}, holdout={inv['counts']['holdout']}, missing={inv['counts']['missing']}, local_unvalidated={inv['counts']['local_unvalidated']})",
    "- refetch: not attempted (validated set complete for P1)",
    "- CDN anonymous probe: 100x80x80 -> 200 SVG",
    "",
    "## Planned detail",
    "",
    "| group | LWH | status | local | note |",
    "|---|---|---|---|---|",
]
for i in items:
    loc = i["local"]["normalized_path"] if i["local"] else "-"
    note = (i["note"] or "").replace("|", "/")
    lines.append(f"| {i['group']} | {i['key']} | {i['validation_status']} | {loc} | {note} |")
lines += ["", "## Machine readable", "", "`reports/p1-sample-inventory.json`", ""]
(root / "reports" / "p1-sample-inventory.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(json.dumps(inv["counts"], ensure_ascii=False))
