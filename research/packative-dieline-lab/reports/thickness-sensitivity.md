# Thickness / kerf sensitivity (research)

## Scope
- Holdout `100x80x90` (`100×80×90`)
- Hooks: `thicknessMm` → `bodyExtraHMm`; `kerfMm/2` → `tipAddMm` + `bigAddMm`
- **Not** a fitted paper-caliper rule; samples still `thickness: null`

## Identity (`t=0,k=0`)
- cutting=61 creasing=14
- matches baseline counts: **yes**

## Competitive explanations
| claim | status |
|---|---|
| bodyExtraHMm=0.5 equals paper thickness compensation | rejected_unproven |
| sideBottomLiftMm=0.5 equals caliper | rejected_unproven |
| kerfMm half-applied to tipAdd/bigAdd is production kerf | unvalidated_hook |

## Grid
| t mm | k mm | cuts | ΔyBodyTop uu | ΔtipDepth mm | bodyExtraH | tipAdd | bigAdd |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 61 | 0.000 | 0.000 | 0.5 | 5 | 10.5 |
| 0 | 0.2 | 61 | 0.378 | 0.100 | 0.5 | 5.1 | 10.6 |
| 0.5 | 0 | 61 | 1.890 | 0.000 | 1 | 5 | 10.5 |
| 0.5 | 0.2 | 61 | 2.268 | 0.100 | 1 | 5.1 | 10.6 |
| 1 | 0 | 61 | 3.780 | 0.000 | 1.5 | 5 | 10.5 |
| 1 | 0.2 | 61 | 4.157 | 0.100 | 1.5 | 5.1 | 10.6 |

## Notes
- Top-flap / outline fillet thickness hooks are **not** wired in this slice.
- Do not treat this report as production kerf/caliper validation.
