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
| lock_bottom_cutting_correspondence | real_sample | **passed** | holdout=100x80x90; matched=21/21; medianNorm=0.0006; curve_approx |
| top_flap_cutting_correspondence | real_sample | **passed** | holdout=100x80x90; matched=29/29; medianNorm=0.0045; curve_approx |
| body_outline_cutting_correspondence | real_sample | **passed** | holdout=100x80x90; matched=11/11; medianNorm=0.0007; cubicPairs=8; medianCubicNorm=0.0000; curve_exact |
| structural_cutting_count_correspondence | real_sample | **passed** | holdout=100x80x90; realStructural=61; proto=61; zero=2 |
| holdout_full_crashlock_topology | real_sample | **blocked** | raw_63_includes_export_zero_length_artifacts_not_emitted |
| synthetic_svg_emits_ev_style | synthetic | **passed** |  |

## Privacy scan
- hits: none

## Verdict
- Envelope models (`lwh_linear` / `lwh_interact`) on frozen holdout `100x80x90` — see `envelope-diagnosis.md` (linear vs interaction).
- Creasing segment correspondence: **passed** (see segment-match.md).
- Lock-bottom cutting correspondence: **passed** (see lock-bottom-match.md; curve_approx).
- Top-flap / glue cutting correspondence: **passed** (see top-flap-match.md; curve_approx).
- Body-outline cutting correspondence: **passed** (see body-outline-match.md; endpoint + cubic residual).
- Structural cutting count: **passed** (see structural-cutting-match.md; expect 61).
- Full crashlock topology: **blocked** (`raw_63_includes_export_zero_length_artifacts_not_emitted`) — raw 63 includes export artifacts not emitted; not production.
