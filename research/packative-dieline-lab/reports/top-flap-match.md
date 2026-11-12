# Top-flap / glue cutting match

## Gate (holdout `100x80x90`)
- require matched ≥ **22** / ~26 real top+glue lines
- median norm pos err ≤ **0.06**
- result: **PASSED**
- holdout matched=29/29 medianNorm=0.0045

## Notes
- Parametric L/W/H → dust flaps + tuck tongues + glue outer (not single-sample replay)
- `curve_approx`: cubic corners as chords
- Full 63/14 topology still **not** claimed

## Rows
| sample | role | matched | real | medianNorm | pass |
|---|---|---:|---:|---:|---|
| 100x70x80 | train_or_other | 29 | 29 | 0.0057 | yes |
| 100x80x70 | train_or_other | 29 | 29 | 0.0045 | yes |
| 100x80x80 | train_or_other | 29 | 29 | 0.0045 | yes |
| 100x80x90 | holdout | 29 | 29 | 0.0045 | yes |
| 100x90x80 | train_or_other | 29 | 29 | 0.0061 | yes |
| 110x80x80 | train_or_other | 29 | 29 | 0.0092 | yes |
| 120x90x60 | pressure | 29 | 29 | 0.0193 | yes |
| 200x150x100 | train_or_other | 29 | 29 | 0.0393 | yes |
| 55x55x75 | train_or_other | 27 | 27 | 0.0200 | yes |
| 90x80x80 | train_or_other | 29 | 29 | 0.0066 | yes |

## Counterexamples
- none (excluding pressure row)
