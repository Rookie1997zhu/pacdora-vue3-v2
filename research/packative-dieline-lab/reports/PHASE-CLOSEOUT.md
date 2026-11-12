# Crashlock research phase closeout

## Verdict

Structural crashlock dieline research in this lab is **complete for the agreed scope**: parametric geometry matches holdout region gates; raw Packative count 63 is explained without faking stubs.

- Product: `productbox-crashlock` only
- Holdout: `100×80×90`
- Structural topology: **61 Cutting + 14 Creasing**
- Production claim: **no**

## Evidence chain

1. Envelope L/W/H fit → holdout width/height passed
2. Creasing correspondence → 14 lines gated
3. Lock-bottom / top-flap / body-outline region matches → passed
4. Exact cubics relocated: lock 2 + top 6 → residual gates `curve_exact`; outline lines-only
5. Zero-length inventory → Class A export artifacts (maxX∩bodyBottom); Class B collapsed lock shelf on `55×55×75` only
6. Structural count gate → real structural ≡ proto **61** (holdout and 55)

## Why full topology stays blocked

`holdout_full_crashlock_topology` remains **blocked** with reason:

`raw_63_includes_export_zero_length_artifacts_not_emitted`

Raw SVG Cutting=63 includes Class A duplicates that are not structural knife paths. Prototype correctly emits 61. Emitting zero-length stubs would only inflate the count.

## Follow-ups

- Material thickness / kerf: **hooks exist** (`thicknessMm`/`kerfMm`, default 0) as unvalidated sensitivity — see `thickness-sensitivity.md`. Coefficients still **unobserved** (`inferred.thickness = null`).
- Wire lab rules into BOXCRAFT production (Vue/Django) — new scope
- Keep `paid_actions=false`; do not use EPS BoundingBox as dieline size

## Key reports

- `validation-report.md` / `validation-results.json`
- `body-outline-match.md` / `structural-cutting-match.md` / `degenerate-segments.md`
- `thickness-sensitivity.md`
- `gaps.md` / `DELIVERY.md`
