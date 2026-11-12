# Top-flap / glue cutting match

## Gate (holdout `100x80x90`)
- require matched ≥ **28** / ~32 real top+glue segs
- median norm pos err ≤ **0.06**
- cubic pairs ≥ **6** with median cubic norm err ≤ **0.06**
- result: **PASSED**
- holdout matched=35/35 medianNorm=0.0038 cubicPairs=6 medianCubicNorm=0.0000 curve_exact=true

## Notes
- Parametric dust flaps + tuck tongues + glue outer + **6 exact top fillets**
- Tip/glue chamfers remain lines
- Full 63/14 topology still **not** claimed

## Rows
| sample | role | matched | real | medianNorm | cubicPairs | medianCubic | pass |
|---|---|---:|---:|---:|---:|---:|---|
| 100x70x80 | train_or_other | 35 | 35 | 0.0049 | 6 | 0.0000 | yes |
| 100x80x70 | train_or_other | 35 | 35 | 0.0038 | 6 | 0.0000 | yes |
| 100x80x80 | train_or_other | 35 | 35 | 0.0038 | 6 | 0.0000 | yes |
| 100x80x90 | holdout | 35 | 35 | 0.0038 | 6 | 0.0000 | yes |
| 100x90x80 | train_or_other | 35 | 35 | 0.0053 | 6 | 0.0000 | yes |
| 110x80x80 | train_or_other | 35 | 35 | 0.0070 | 6 | 0.0000 | yes |
| 120x90x60 | pressure | 35 | 35 | 0.0104 | 6 | 0.0000 | yes |
| 200x150x100 | train_or_other | 35 | 35 | 0.0355 | 6 | 0.0000 | yes |
| 55x55x75 | train_or_other | 33 | 33 | 0.0153 | 6 | 0.0000 | yes |
| 90x80x80 | train_or_other | 35 | 35 | 0.0048 | 6 | 0.0000 | yes |

## Counterexamples
- none (excluding pressure row)
