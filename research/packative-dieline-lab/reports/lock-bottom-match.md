# Lock-bottom cutting match

## Gate (holdout `100x80x90`)
- require matched ≥ **18** / ~21 real lock lines
- median norm pos err ≤ **0.06**
- result: **PASSED**
- holdout matched=21/21 medianNorm=0.0006

## Notes
- Parametric L/W/H → lock polyline (not single-sample replay)
- `curve_approx`: cubic corners as chords
- Full 63/14 topology still **not** claimed

## Rows
| sample | role | matched | real | medianNorm | pass |
|---|---|---:|---:|---:|---|
| 100x70x80 | train_or_other | 21 | 21 | 0.0007 | yes |
| 100x80x70 | train_or_other | 21 | 21 | 0.0006 | yes |
| 100x80x80 | train_or_other | 21 | 21 | 0.0006 | yes |
| 100x80x90 | holdout | 21 | 21 | 0.0006 | yes |
| 100x90x80 | train_or_other | 21 | 21 | 0.0006 | yes |
| 110x80x80 | train_or_other | 21 | 21 | 0.0006 | yes |
| 120x90x60 | pressure | 21 | 21 | 0.0006 | yes |
| 200x150x100 | train_or_other | 21 | 21 | 0.0003 | yes |
| 55x55x75 | train_or_other | 21 | 21 | 0.0009 | yes |
| 90x80x80 | train_or_other | 21 | 21 | 0.0006 | yes |

## Counterexamples
- none (excluding pressure row)
