# Prototype gaps (crashlock lock+top+outline + exact cubics)

## Implemented
- Outer envelope size from L/W/H fit (SVG user units)
- Parametric **14** body Creasing lines
- Parametric lock-bottom **Cutting** (~21)
- Parametric top dust flaps + tuck + glue (~26–29)
- Parametric body outline: right outer, L-bottom cut, micro bridge (~11 leftovers)
- Body fillet corners: **exact cubic** (`filletsExact`; 8 `<path C>`)

## Not implemented (explicit)
- Zero-length degenerate stubs (intentionally omitted)
- Full 63 Cutting / production claim

## Generated files
- `proto-crashlock-100_80_80-outline.svg` cuts=61 creases=14 fillets_exact=true widthUu=1404.093 heightUu=831.496
- `proto-crashlock-55_55_75-outline.svg` cuts=61 creases=14 fillets_exact=true widthUu=874.960 heightUu=661.418
- `proto-crashlock-100_90_80-outline.svg` cuts=61 creases=14 fillets_exact=true widthUu=1479.684 heightUu=891.969
- `proto-crashlock-100_80_90-outline.svg` cuts=61 creases=14 fillets_exact=true widthUu=1404.091 heightUu=869.291
