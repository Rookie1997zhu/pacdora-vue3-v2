# Lock-bottom cutting match

## Gate (holdout `100x80x90`)
- require matched ≥ **20** / ~23 real lock segs
- median norm pos err ≤ **0.06**
- cubic pairs ≥ **2** with median cubic norm err ≤ **0.06**
- result: **PASSED**
- holdout matched=23/23 medianNorm=0.0006 cubicPairs=2 medianCubicNorm=0.0054 curve_exact=true

## Notes
- Parametric L/W/H → lock polyline + **2 exact big-flap cubics**
- Hook/chamfer diagonals remain lines
- Full 63/14 topology still **not** claimed

## Rows
| sample | role | matched | real | medianNorm | cubicPairs | medianCubic | pass |
|---|---|---:|---:|---:|---:|---:|---|
| 100x70x80 | train_or_other | 23 | 23 | 0.0007 | 2 | 0.0058 | yes |
| 100x80x70 | train_or_other | 23 | 23 | 0.0006 | 2 | 0.0054 | yes |
| 100x80x80 | train_or_other | 23 | 23 | 0.0006 | 2 | 0.0054 | yes |
| 100x80x90 | holdout | 23 | 23 | 0.0006 | 2 | 0.0054 | yes |
| 100x90x80 | train_or_other | 23 | 23 | 0.0006 | 2 | 0.0050 | yes |
| 110x80x80 | train_or_other | 23 | 23 | 0.0006 | 2 | 0.0052 | yes |
| 120x90x60 | pressure | 23 | 23 | 0.0006 | 2 | 0.0047 | yes |
| 200x150x100 | train_or_other | 23 | 23 | 0.0003 | 2 | 0.0028 | yes |
| 55x55x75 | train_or_other | 23 | 23 | 0.0010 | 2 | 0.0085 | yes |
| 90x80x80 | train_or_other | 23 | 23 | 0.0007 | 2 | 0.0056 | yes |

## Counterexamples
- none (excluding pressure row)
