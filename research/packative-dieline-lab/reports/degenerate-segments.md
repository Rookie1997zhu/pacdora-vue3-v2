# Degenerate Cutting segments (Class A / Class B)

## Holdout `100x80x90`
- raw Cutting = **63**
- zero-length = **2** (Class A=2, Class B=0)
- structural = **61** (= raw − Class A)
- Class A at geom maxX ∩ bodyBottom±12uu: **yes**

## Classification
- **Class A** `exportArtifact`: duplicate zero-length `<line>` at maxX ∩ body-bottom fold band — **not** structural
- **Class B** `collapsedLockShelf`: lock kink shelf collapsed to zero (seen on `55×55×75`) — kept in structural count
- Prototype omits Class A; does not emit stubs to fake raw 63

## `55×55×75`
- raw=63 zero=4 ClassA=2 ClassB=2 structural=61 (collapsed_lock_shelf×2)

## Rows
| sample | role | raw | zero | A | B | structural | note |
|---|---|---:|---:|---:|---:|---:|---|
| 100x80x80 | other | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
| 100x70x80 | other | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
| 100x80x70 | other | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
| 100x80x80 | other | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
| 100x80x90 | holdout | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
| 100x90x80 | other | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
| 110x80x80 | other | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
| 120x90x60 | other | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
| 200x150x100 | other | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
| 55x55x75 | other | 63 | 4 | 2 | 2 | 61 | collapsed_lock_shelf×2 |
| 90x80x80 | other | 63 | 2 | 2 | 0 | 61 | export_artifact×2 |
