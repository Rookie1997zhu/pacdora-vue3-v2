# Body-outline cutting match

## Gate (holdout `100x80x90`)
- require matched ≥ **8** / ~11 meaningful leftover lines
- median norm pos err ≤ **0.06**
- cubic pairs ≥ **8** with median cubic norm err ≤ **0.06**
- result: **PASSED**
- holdout matched=11/11 medianNorm=0.0007 cubicPairs=8 medianCubicNorm=0.0000 curve_exact=true

## Notes
- Parametric outline + **exact cubic** fillets; zero-length omitted
- Full 63/14 topology still **not** claimed

## Rows
| sample | role | matched | real | medianNorm | cubicPairs | medianCubic | pass |
|---|---|---:|---:|---:|---:|---:|---|
| 100x70x80 | train_or_other | 11 | 11 | 0.0007 | 8 | 0.0000 | yes |
| 100x80x70 | train_or_other | 11 | 11 | 0.0007 | 8 | 0.0000 | yes |
| 100x80x80 | train_or_other | 11 | 11 | 0.0007 | 8 | 0.0000 | yes |
| 100x80x90 | holdout | 11 | 11 | 0.0007 | 8 | 0.0000 | yes |
| 100x90x80 | train_or_other | 11 | 11 | 0.0007 | 8 | 0.0000 | yes |
| 110x80x80 | train_or_other | 11 | 11 | 0.0007 | 8 | 0.0000 | yes |
| 120x90x60 | pressure | 11 | 11 | 0.0006 | 8 | 0.0000 | yes |
| 200x150x100 | train_or_other | 11 | 11 | 0.0004 | 8 | 0.0000 | yes |
| 55x55x75 | train_or_other | 11 | 11 | 0.0011 | 8 | 0.0000 | yes |
| 90x80x80 | train_or_other | 11 | 11 | 0.0007 | 8 | 0.0000 | yes |

## Counterexamples
- none (excluding pressure row)
