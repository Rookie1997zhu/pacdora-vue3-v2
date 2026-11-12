# Prototype gaps (crashlock lock-bottom first slice)

## Implemented
- Outer envelope size from L/W/H fit (SVG user units)
- Parametric **14** body Creasing lines (panel layout glue|L|W|L|W)
- Parametric lock-bottom **Cutting** polyline (~21 lines: side wings + center flap/hooks)
- Cubic corners: **curve_approx** (chord / fixed mm notches)

## Not implemented (explicit)
- Top dust flaps / tuck tongue outer cutting
- Glue flap outer cutting topology
- Six small top-flap fillets
- Exact cubic corner paths
- Full 63 Cutting / production claim

## Generated files
- `proto-crashlock-100_80_80-lockbottom.svg` cuts=21 creases=14 widthUu=1404.093 heightUu=831.496
- `proto-crashlock-55_55_75-lockbottom.svg` cuts=21 creases=14 widthUu=874.960 heightUu=661.418
- `proto-crashlock-100_90_80-lockbottom.svg` cuts=21 creases=14 widthUu=1479.684 heightUu=891.969
- `proto-crashlock-100_80_90-lockbottom.svg` cuts=21 creases=14 widthUu=1404.091 heightUu=869.291
