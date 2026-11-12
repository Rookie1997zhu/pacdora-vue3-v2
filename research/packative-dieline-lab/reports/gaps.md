# Prototype gaps (crashlock structural topology)

## Status
- **research phase complete (structural)** — lab only; not production

## Implemented
- Outer envelope size from L/W/H fit (SVG user units)
- Parametric **14** body Creasing lines
- Parametric lock-bottom **Cutting** (~21)
- Parametric top dust flaps + tuck + glue (~26–29)
- Parametric body outline: right outer, L-bottom cut, micro bridge (~11 leftovers)
- Body fillet corners: **exact cubic** (`filletsExact`; 8 `<path C>`)
- Zero-length Class A = `exportArtifact` (maxX∩bodyBottom); Class B = `collapsedLockShelf` (kept in structural)
- Structural cutting = raw − Class A only (**61**)
- Material hooks: optional `thicknessMm` / `kerfMm` (default 0); **unvalidated** sensitivity only

## Not implemented (explicit / optional later)
- Fitted paper-caliper / production kerf coefficients (samples still `thickness: null`)
- Top-flap tuck inset thickness wiring
- BOXCRAFT production wiring (Vue/Django)
- Emitting Class A zero-length stubs to fake raw 63

## Generated files
- `proto-crashlock-100_80_80-outline.svg` cuts=61 creases=14 fillets_exact=true widthUu=1404.093 heightUu=831.496
- `proto-crashlock-55_55_75-outline.svg` cuts=61 creases=14 fillets_exact=true widthUu=874.960 heightUu=661.418
- `proto-crashlock-100_90_80-outline.svg` cuts=61 creases=14 fillets_exact=true widthUu=1479.684 heightUu=891.969
- `proto-crashlock-100_80_90-outline.svg` cuts=61 creases=14 fillets_exact=true widthUu=1404.091 heightUu=869.291
