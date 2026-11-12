# Structural cutting count match

## Gate (holdout `100x80x90`)
- real structural Cutting === proto Cutting (expect **61**)
- real Class A exportArtifact ≥ **1**
- structural = raw − Class A only (Class B not deducted)
- proto must not emit zero-length stubs
- result: **PASSED**
- holdout raw=63 A=2 B=0 structural=61 proto=61

## `55×55×75`
- raw=63 A=2 B=2 structural=61 proto=61 pass=yes (collapsed_lock_shelf×2)

## Notes
- Raw 63 includes Class A export artifacts; structural topology is 61 + 14 creases.
- Full raw-63 / production claim remains blocked.

## Rows
| sample | role | raw | A | B | structural | proto | pass | note |
|---|---|---:|---:|---:|---:|---:|---|---|
| 100x80x80 | other | 63 | 2 | 0 | 61 | 61 | yes | — |
| 100x70x80 | other | 63 | 2 | 0 | 61 | 61 | yes | — |
| 100x80x70 | other | 63 | 2 | 0 | 61 | 61 | yes | — |
| 100x80x80 | other | 63 | 2 | 0 | 61 | 61 | yes | — |
| 100x80x90 | holdout | 63 | 2 | 0 | 61 | 61 | yes | — |
| 100x90x80 | other | 63 | 2 | 0 | 61 | 61 | yes | — |
| 110x80x80 | other | 63 | 2 | 0 | 61 | 61 | yes | — |
| 120x90x60 | other | 63 | 2 | 0 | 61 | 61 | yes | — |
| 200x150x100 | other | 63 | 2 | 0 | 61 | 61 | yes | — |
| 55x55x75 | other | 63 | 2 | 2 | 61 | 61 | yes | collapsed_lock_shelf×2 |
| 90x80x80 | other | 63 | 2 | 0 | 61 | 61 | yes | — |
