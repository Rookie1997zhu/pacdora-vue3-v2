# Body-outline cutting match

## Gate (holdout `100x80x90`)
- require matched ≥ **2** / ~3 leftover lines
- median norm pos err ≤ **0.06**
- cubic pairs **optional** (relocated to lock/top)
- result: **PASSED**
- holdout matched=3/3 medianNorm=0.0002 cubicPairs=0 medianCubicNorm=Infinity lines_only=true

## Notes
- Outline leftovers are straight edges; 8 exact cubics live in lock/top slices
- Full 63/14 topology still **not** claimed

## Rows
| sample | role | matched | real | medianNorm | cubicPairs | medianCubic | pass |
|---|---|---:|---:|---:|---:|---:|---|
| 100x70x80 | train_or_other | 3 | 3 | 0.0002 | 0 | Infinity | yes |
| 100x80x70 | train_or_other | 3 | 3 | 0.0002 | 0 | Infinity | yes |
| 100x80x80 | train_or_other | 3 | 3 | 0.0002 | 0 | Infinity | yes |
| 100x80x90 | holdout | 3 | 3 | 0.0002 | 0 | Infinity | yes |
| 100x90x80 | train_or_other | 3 | 3 | 0.0002 | 0 | Infinity | yes |
| 110x80x80 | train_or_other | 3 | 3 | 0.0002 | 0 | Infinity | yes |
| 120x90x60 | pressure | 3 | 3 | 0.0002 | 0 | Infinity | yes |
| 200x150x100 | train_or_other | 3 | 3 | 0.0001 | 0 | Infinity | yes |
| 55x55x75 | train_or_other | 3 | 3 | 0.0003 | 0 | Infinity | yes |
| 90x80x80 | train_or_other | 3 | 3 | 0.0002 | 0 | Infinity | yes |

## Counterexamples
- none (excluding pressure row)
