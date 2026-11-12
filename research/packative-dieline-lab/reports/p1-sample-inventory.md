# P1 sample inventory (productbox-crashlock)

generated: 2026-11-12T09:39:46.719942+00:00

## Summary

- validated_rules unique: 10 (all have local normalized)
- holdout_frozen: `100x80x90`
- planned: 24 (validated=9, holdout=1, missing=12, local_unvalidated=2)
- refetch: not attempted (validated set complete for P1)
- CDN anonymous probe: 100x80x80 -> 200 SVG

## Planned detail

| group | LWH | status | local | note |
|---|---|---|---|---|
| baseline | 100x80x80 | validated | data/normalized/studio-dieline-productbox-crashlock-100_80_80.json |  |
| single_var | 90x80x80 | validated | data/normalized/studio-dieline-productbox-crashlock-90_80_80.json |  |
| single_var | 110x80x80 | validated | data/normalized/studio-dieline-productbox-crashlock-110_80_80.json |  |
| single_var | 100x70x80 | validated | data/normalized/studio-dieline-productbox-crashlock-100_70_80.json |  |
| single_var | 100x90x80 | validated | data/normalized/studio-dieline-productbox-crashlock-100_90_80.json |  |
| single_var | 100x80x70 | validated | data/normalized/studio-dieline-productbox-crashlock-100_80_70.json |  |
| single_var | 100x80x90 | holdout | data/normalized/studio-dieline-productbox-crashlock-100_80_90.json |  |
| interaction | 110x90x80 | missing | - |  |
| interaction | 110x80x90 | missing | - |  |
| interaction | 100x90x90 | missing | - |  |
| cross_scale | 55x55x75 | validated | data/normalized/studio-dieline-productbox-crashlock-55_55_75.json |  |
| cross_scale | 100x80x50 | local_unvalidated | data/normalized/studio-dieline-productbox-crashlock-100_80_50.json |  |
| cross_scale | 200x150x100 | validated | data/normalized/studio-dieline-productbox-crashlock-200_150_100.json |  |
| cross_scale | 300x200x150 | local_unvalidated | data/normalized/studio-dieline-productbox-crashlock-300_200_150.json |  |
| near_boundary | 25x25x25 | missing | - | illegal or boundary candidate; verify against limits before use |
| near_boundary | 25x80x80 | missing | - | boundary candidate |
| near_boundary | 400x80x80 | missing | - | upper boundary candidate |
| near_boundary | 100x350x80 | missing | - | width upper candidate |
| holdout | 120x90x60 | validated | data/normalized/studio-dieline-productbox-crashlock-120_90_60.json |  |
| holdout | 130x100x70 | missing | - |  |
| holdout | 150x110x90 | missing | - |  |
| holdout | 180x120x80 | missing | - |  |
| holdout | 220x160x110 | missing | - |  |
| holdout | 95x75x85 | missing | - |  |

## Machine readable

`reports/p1-sample-inventory.json`

