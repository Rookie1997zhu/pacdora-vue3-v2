# Degenerate / export-artifact Cutting segments

## Holdout `100x80x90`
- raw Cutting = **63**
- zero-length = **2**
- structural = **61**
- zeros at geom maxX ∩ body-top: **no/partial**

## Classification
- These are **export artifacts** (duplicate zero-length `<line>`), not structural knife paths.
- Prototype omits them on purpose; raw 63 ≠ structural topology.

## Rows
| sample | role | raw | zero | structural | all@maxX∩bodyTop |
|---|---|---:|---:|---:|---|
| 100x80x80 | other | 63 | 2 | 61 | no |
| 100x70x80 | other | 63 | 2 | 61 | no |
| 100x80x70 | other | 63 | 2 | 61 | no |
| 100x80x80 | other | 63 | 2 | 61 | no |
| 100x80x90 | holdout | 63 | 2 | 61 | no |
| 100x90x80 | other | 63 | 2 | 61 | no |
| 110x80x80 | other | 63 | 2 | 61 | no |
| 120x90x60 | other | 63 | 2 | 61 | no |
| 200x150x100 | other | 63 | 2 | 61 | no |
| 55x55x75 | other | 63 | 4 | 59 | no |
| 90x80x80 | other | 63 | 2 | 61 | no |
