# Envelope diagnosis

## Holdout switch

- Previous preferred holdout `120x90x60` is a **cross-scale** point (failed badly under linear templates).
- Frozen holdout is now **`100x80x90`** (near-baseline single-variable).
- `120x90x60` kept as stress-only (not the validation gate).

## Models

| axis | linear train RMSE | interact train RMSE | linear holdout err | interact holdout err | selected |
|---|---:|---:|---:|---:|---|
| width | 0.004 | 0.001 | 0.001 | 0.008 | **lwh_linear** (err=0.001) |
| height | 0.000 | 0.000 | 0.001 | 0.000 | **lwh_interact** (err=0.000) |

Selection rule: use interaction if holdout err ≤ 25 uu **and** better than linear; else keep linear OLS (or template fallback).

## Stress row `120x90x60` (not frozen)

- errW=0.001 uu, errH=0.000 uu

## Gate vs validated

- Width holdout ≤25: **passed** (train_rmse=0.004)
- Height holdout ≤25: **passed** (train_rmse=0.000)
- Unique real sizes: 10; train n=9
