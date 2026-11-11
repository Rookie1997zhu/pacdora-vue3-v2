# Validation report (phase 4)

## Online collection
- collected: **0**
- 本轮在线采集 0 条（live_collection=false）

## Tests
| id | kind | status | detail |
|---|---|---|---|
| detect_access_denied_stubs | real_sample | **passed** | excluded_non_dieline_xml stubs; count=3 |
| holdout_envelope_width | real_sample | **passed** | err=6.312 uu |
| holdout_envelope_height | real_sample | **failed** | err=76.638 uu |
| holdout_full_crashlock_topology | real_sample | **not_run** | lock_bottom_geometry_not_implemented |
| synthetic_svg_emits_ev_style | synthetic | **passed** |  |

## Privacy scan
- hits: none

## Verdict
- Envelope width model: evaluated on frozen holdout `200x150x100` without rescaling.
- Envelope height: may fail holdout with sparse offline sizes — see test table (do not claim).
- Full crashlock structure: **not claimed**.
