# Body-outline cutting match

## Gate (holdout `100x80x90`)
- require matched ≥ **8** / ~11 meaningful leftover lines
- median norm pos err ≤ **0.06**
- result: **PASSED**
- holdout matched=11/11 medianNorm=0.0096 cuttingTotal=61

## Notes
- Parametric outline + fillet chords (`curve_approx`); zero-length omitted
- Full 63/14 topology still **not** claimed

## Rows
| sample | role | matched | real | medianNorm | pass |
|---|---|---:|---:|---:|---|
| 100x70x80 | train_or_other | 11 | 11 | 0.0107 | yes |
| 100x80x70 | train_or_other | 11 | 11 | 0.0107 | yes |
| 100x80x80 | train_or_other | 11 | 11 | 0.0101 | yes |
| 100x80x90 | holdout | 11 | 11 | 0.0096 | yes |
| 100x90x80 | train_or_other | 11 | 11 | 0.0096 | yes |
| 110x80x80 | train_or_other | 11 | 11 | 0.0101 | yes |
| 120x90x60 | pressure | 11 | 11 | 0.0106 | yes |
| 200x150x100 | train_or_other | 11 | 11 | 0.0066 | yes |
| 55x55x75 | train_or_other | 11 | 11 | 0.0126 | yes |
| 90x80x80 | train_or_other | 11 | 11 | 0.0102 | yes |

## Counterexamples
- none (excluding pressure row)
