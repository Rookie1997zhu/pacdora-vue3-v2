# Thickness / kerf sensitivity (research)

## Scope
- Holdout `100x80x90` (`100×80×90`)
- Lock: `thicknessMm` → `bodyExtraHMm`; `kerfMm/2` → lock `tipAddMm` + `bigAddMm`
- Top: `thicknessMm` → `tuckOuter/InnerInsetMm`; `kerfMm/2` → top `tipAddMm`
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
| thicknessMm → tuckOuter/InnerInset equals fitted board clearance | unvalidated_hook |
| kerfMm/2 → top tipAddMm equals production top tip kerf | unvalidated_hook |

## Grid
| t mm | k mm | cuts | ΔyBodyTop uu | ΔlockTip mm | tuckOut | tuckIn | topTipAdd | ΔtopTip mm |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 61 | 0.000 | 0.000 | 2.57 | 2.00 | 1.00 | 0.000 |
| 0 | 0.2 | 61 | 0.378 | 0.100 | 2.57 | 2.00 | 1.10 | 0.100 |
| 0.5 | 0 | 61 | 1.890 | 0.000 | 3.07 | 2.50 | 1.00 | 0.000 |
| 0.5 | 0.2 | 61 | 2.268 | 0.100 | 3.07 | 2.50 | 1.10 | 0.100 |
| 1 | 0 | 61 | 3.780 | 0.000 | 3.57 | 3.00 | 1.00 | 0.000 |
| 1 | 0.2 | 61 | 4.157 | 0.100 | 3.57 | 3.00 | 1.10 | 0.100 |

## Notes
- Dust / fillet / glue thickness hooks remain unwired.
- Do not treat this report as production kerf/caliper validation.
