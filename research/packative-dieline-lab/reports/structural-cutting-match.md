# Structural cutting count match

## Gate (holdout `100x80x90`)
- real structural Cutting === proto Cutting (expect **61**)
- real zero-length ≥ **1** (holdout typically 2)
- proto must not emit zero-length stubs
- result: **PASSED**
- holdout raw=63 zero=2 structural=61 proto=61

## Notes
- Raw 63 includes export artifacts; structural topology is 61 + 14 creases.
- Full raw-63 / production claim remains blocked.

## Rows
| sample | role | raw | zero | structural | proto | pass |
|---|---|---:|---:|---:|---:|---|
| 100x80x80 | other | 63 | 2 | 61 | 61 | yes |
| 100x70x80 | other | 63 | 2 | 61 | 61 | yes |
| 100x80x70 | other | 63 | 2 | 61 | 61 | yes |
| 100x80x80 | other | 63 | 2 | 61 | 61 | yes |
| 100x80x90 | holdout | 63 | 2 | 61 | 61 | yes |
| 100x90x80 | other | 63 | 2 | 61 | 61 | yes |
| 110x80x80 | other | 63 | 2 | 61 | 61 | yes |
| 120x90x60 | other | 63 | 2 | 61 | 61 | yes |
| 200x150x100 | other | 63 | 2 | 61 | 61 | yes |
| 55x55x75 | other | 63 | 4 | 59 | 61 | no |
| 90x80x80 | other | 63 | 2 | 61 | 61 | yes |
