# Validation report (phase 4)

## Offline ingest
- new priority single-var OK: **6** (target ≥3)
- note: offline_single_var_target_met

## Online collection
- collected: **0**
- online collect finished: 0 written, 9 GETs

## Tests
| id | kind | status | detail |
|---|---|---|---|
| detect_access_denied_stubs | real_sample | **passed** | excluded_non_dieline_xml stubs; count=2 |
| holdout_envelope_width | real_sample | **passed** | err=0.001 uu |
| holdout_envelope_height | real_sample | **passed** | err=0.000 uu |
| crease_segment_correspondence | real_sample | **passed** | min_matched=14; worst_norm=0.0586; worst_uu=98.66; pairs=45 |
| lock_bottom_cutting_correspondence | real_sample | **passed** | holdout=100x80x90; matched=23/23; medianNorm=0.0006; cubicPairs=2; medianCubicNorm=0.0054; curve_exact |
| top_flap_cutting_correspondence | real_sample | **passed** | holdout=100x80x90; matched=35/35; medianNorm=0.0038; cubicPairs=6; medianCubicNorm=0.0000; curve_exact |
| body_outline_cutting_correspondence | real_sample | **passed** | holdout=100x80x90; matched=3/3; medianNorm=0.0002; lines_only; cubics_relocated_to_lock_top |
| structural_cutting_count_correspondence | real_sample | **passed** | holdout=100x80x90; realStructural=61; proto=61; exportArtifact=2; collapsedLockShelf=0 |
| holdout_full_crashlock_topology | real_sample | **blocked** | raw_63_includes_export_zero_length_artifacts_not_emitted |
| synthetic_svg_emits_ev_style | synthetic | **passed** |  |
| material_hooks_identity_at_zero | synthetic | **passed** | t=k=0 bit-identical to bare params; t>0/k>0 moves bodyExtraH/tip hooks |

## Privacy scan
- hits: none

## Verdict
- Envelope models (`lwh_linear` / `lwh_interact`) on frozen holdout `100x80x90` — see `envelope-diagnosis.md` (linear vs interaction).
- Creasing segment correspondence: **passed** (see segment-match.md).
- Lock-bottom cutting correspondence: **passed** (see lock-bottom-match.md; endpoint + 2 exact cubics).
- Top-flap / glue cutting correspondence: **passed** (see top-flap-match.md; endpoint + 6 exact cubics).
- Body-outline cutting correspondence: **passed** (see body-outline-match.md; lines-only leftovers).
- Structural cutting count: **passed** (see structural-cutting-match.md; expect 61).
- Full crashlock topology: **blocked** (`raw_63_includes_export_zero_length_artifacts_not_emitted`) — raw 63 includes export artifacts not emitted; not production.
- Research phase: **complete (structural)** — see `PHASE-CLOSEOUT.md` / `DELIVERY.md`.
