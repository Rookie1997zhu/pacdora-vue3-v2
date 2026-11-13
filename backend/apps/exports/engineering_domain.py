from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DATA_ROOT = Path(__file__).resolve().parent / 'data'
_DOMAINS_ROOT = _DATA_ROOT / 'domains'


@lru_cache(maxsize=32)
def load_engineering_domain(template_id: str) -> dict | None:
    tid = str(template_id or '').strip()
    if not tid:
        return None
    path = _DOMAINS_ROOT / f'{tid}-engineering-domain.json'
    if not path.is_file():
        # Legacy flat path (phase 2)
        legacy = _DATA_ROOT / f'{tid}-engineering-domain.json'
        if legacy.is_file():
            return json.loads(legacy.read_text(encoding='utf-8'))
        return None
    return json.loads(path.read_text(encoding='utf-8'))


def load_fefco0201_engineering_domain() -> dict:
    doc = load_engineering_domain('fefco-0201')
    if not doc:
        raise FileNotFoundError('fefco-0201 engineering domain missing')
    return doc


def _in_range(value, range_pair) -> bool:
    if not isinstance(range_pair, (list, tuple)) or len(range_pair) != 2:
        return False
    try:
        n = float(value)
    except (TypeError, ValueError):
        return False
    return float(range_pair[0]) <= n <= float(range_pair[1])


def check_engineering_domain(payload: dict) -> dict:
    """Return {ok, code, detail} for engineering-tier domain gate."""
    template_id = str(payload.get('template_id') or '').strip()
    domain = load_engineering_domain(template_id)
    if not domain:
        return {
            'ok': False,
            'code': 'OUT_OF_ENGINEERING_DOMAIN',
            'detail': f'no engineering domain registered for template {template_id or "(empty)"}',
        }
    if str(domain.get('templateId') or '') != template_id:
        return {
            'ok': False,
            'code': 'OUT_OF_ENGINEERING_DOMAIN',
            'detail': f'domain templateId mismatch: file={domain.get("templateId")} input={template_id}',
        }
    size_mode = str(payload.get('size_mode') or 'inner')
    if size_mode != domain.get('dimensionBasis', 'inner'):
        return {
            'ok': False,
            'code': 'OUT_OF_ENGINEERING_DOMAIN',
            'detail': f'dimensionBasis must be {domain.get("dimensionBasis")}, got {size_mode}',
        }
    failures: list[dict] = []
    checks = [
        ('length_mm', payload.get('length_mm'), domain.get('lengthMm')),
        ('width_mm', payload.get('width_mm'), domain.get('widthMm')),
        ('height_mm', payload.get('height_mm'), domain.get('heightMm')),
        ('thickness_mm', payload.get('thickness_mm'), domain.get('thicknessMm')),
    ]
    for field, value, rng in checks:
        if not _in_range(value, rng):
            failures.append({'field': field, 'range': rng, 'value': value})
    materials = domain.get('materialIds') or ['kraft']
    material_id = str(payload.get('material_id') or '')
    if material_id not in materials:
        failures.append({'field': 'material_id', 'allowed': materials, 'value': material_id})
    flutes = domain.get('fluteDirections') or ['L']
    flute = str(payload.get('flute_direction') or '')
    if flute not in flutes:
        failures.append({'field': 'flute_direction', 'allowed': flutes, 'value': flute})
    if failures:
        return {'ok': False, 'code': 'OUT_OF_ENGINEERING_DOMAIN', 'detail': {'failures': failures}}
    return {
        'ok': True,
        'code': 'ENGINEERING_DOMAIN',
        'detail': {
            'qualificationStatus': domain.get('qualificationStatus') or 'engineering_review',
            'compensationNote': domain.get('compensationNote') or '',
        },
    }
