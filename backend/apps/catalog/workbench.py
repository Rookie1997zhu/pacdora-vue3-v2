"""Build public workbench payload for product detail (scheme §10.3)."""

from __future__ import annotations

from apps.exports.engineering_domain import load_engineering_domain

# Align with packages/geometry-engine ENGINE_VERSION
DEFAULT_ENGINE_VERSION = '3.1.0'

# First-batch workbench product config (seed writes these into capabilities).
WORKBENCH_PRODUCTS = {
    'mailer-parametric-demo': {
        'material_ids': ['flute-e', 'flute-b', 'kraft'],
        'tiers': ['vector_proof', 'engineering'],
        'default_params': {
            'lengthMm': 315,
            'widthMm': 202,
            'heightMm': 62,
            'thicknessMm': 1.5,
            'sizeMode': 'manufacturing',
            'materialId': 'flute-e',
            'fluteDirection': 'L',
            'bleedInputMm': 3,
            'advanced': {},
        },
    },
    'fefco-0201': {
        'material_ids': ['flute-b', 'flute-e', 'kraft'],
        'tiers': ['vector_proof', 'engineering'],
        'default_params': {
            'lengthMm': 400,
            'widthMm': 300,
            'heightMm': 200,
            'thicknessMm': 3,
            'sizeMode': 'manufacturing',
            'materialId': 'flute-b',
            'fluteDirection': 'L',
            'bleedInputMm': 5,
            'advanced': {},
        },
    },
    'tuck-end-straight': {
        'material_ids': [
            'kraft-250',
            'kraft-350',
            'art-250',
            'art-350',
            'white-board',
            'kraft',
            'white',
        ],
        'tiers': ['vector_proof', 'engineering'],
        'default_params': {
            'lengthMm': 80,
            'widthMm': 50,
            'heightMm': 150,
            'thicknessMm': 0.5,
            'sizeMode': 'inner',
            'materialId': 'kraft-250',
            'fluteDirection': 'L',
            'bleedInputMm': 3,
            'advanced': {},
        },
    },
    'productbox-crashlock': {
        'material_ids': [
            'kraft-250',
            'kraft-350',
            'art-250',
            'art-350',
            'white-board',
            'kraft',
            'white',
        ],
        'tiers': ['vector_proof', 'engineering'],
        'default_params': {
            'lengthMm': 100,
            'widthMm': 80,
            'heightMm': 80,
            'thicknessMm': 0.6,
            'sizeMode': 'inner',
            'materialId': 'kraft-350',
            'fluteDirection': 'L',
            'bleedInputMm': 3,
            'advanced': {},
        },
    },
    'aircraft-mailer': {
        'template_key': 'rea-aircraft',
        'material_ids': ['flute-e', 'flute-b', 'kraft'],
        'tiers': ['vector_proof'],
        'default_params': {
            'lengthMm': 300,
            'widthMm': 200,
            'heightMm': 60,
            'thicknessMm': 1.5,
            'sizeMode': 'manufacturing',
            'materialId': 'flute-e',
            'fluteDirection': 'L',
            'bleedInputMm': 3,
            'advanced': {},
        },
        'limits': {'length': [80, 1200], 'width': [70, 1200], 'height': [20, 600]},
    },
    # 折叠盒 / 托盘盒代表性入口（采集库全量走前端 import-* preset）
    'folding-tuck-demo': {
        'template_key': 'tuck-end-straight',
        'material_ids': [
            'kraft-250',
            'kraft-350',
            'art-250',
            'art-350',
            'white-board',
            'kraft',
            'white',
        ],
        'tiers': ['vector_proof', 'engineering'],
        'default_params': {
            'lengthMm': 80,
            'widthMm': 50,
            'heightMm': 150,
            'thicknessMm': 0.5,
            'sizeMode': 'inner',
            'materialId': 'kraft-250',
            'fluteDirection': 'L',
            'bleedInputMm': 3,
            'advanced': {},
        },
    },
    'tray-drawer-demo': {
        'template_key': 'drawer-tray',
        'material_ids': [
            'kraft-250',
            'kraft-350',
            'art-250',
            'art-350',
            'white-board',
            'kraft',
            'white',
        ],
        'tiers': ['vector_proof', 'engineering'],
        'default_params': {
            'lengthMm': 200,
            'widthMm': 110,
            'heightMm': 50,
            'thicknessMm': 0.5,
            'sizeMode': 'inner',
            'materialId': 'kraft-250',
            'fluteDirection': 'L',
            'bleedInputMm': 3,
            'advanced': {},
        },
    },
}


def serialize_engineering_domain(template_key: str) -> dict | None:
    domain = load_engineering_domain(template_key)
    if not domain:
        return None
    return {
        'basis': domain.get('dimensionBasis') or 'inner',
        'lengthMm': domain.get('lengthMm'),
        'widthMm': domain.get('widthMm'),
        'heightMm': domain.get('heightMm'),
        'thicknessMm': domain.get('thicknessMm'),
        'status': domain.get('qualificationStatus') or 'engineering_review',
    }


def build_workbench_payload(product) -> dict | None:
    """Return workbench object or None when product is not workbench-enabled."""
    caps = product.capabilities or {}
    if not caps.get('workbench'):
        return None
    # Fixed / locked products never expose workbench even if flag was set by mistake.
    mode = caps.get('geometry_mode') or getattr(product.default_template, 'geometry_mode', None)
    if mode in ('fixed_snapshot', 'model_only'):
        return None
    ver_caps = {}
    ver = product.default_template_version
    if not ver and product.default_template_id:
        ver = product.default_template.versions.filter(is_current=True).first()
    if ver:
        ver_caps = ver.capabilities or {}
    if ver_caps.get('size_locked') or not ver_caps.get('editable_size', True):
        if mode == 'fixed_snapshot':
            return None

    template_key = product.default_template.template_key
    wb_seed = WORKBENCH_PRODUCTS.get(product.slug) or WORKBENCH_PRODUCTS.get(template_key) or {}
    defaults = caps.get('default_params') or wb_seed.get('default_params') or {}
    limits = (ver.limits if ver else None) or wb_seed.get('limits') or {}
    material_ids = caps.get('material_ids') or wb_seed.get('material_ids') or ['kraft']
    tiers = caps.get('tiers') or wb_seed.get('tiers') or ['vector_proof']
    engine_version = (ver.engine_version if ver else None) or DEFAULT_ENGINE_VERSION
    # Prefer ENGINE_VERSION-style if seed still has legacy knife.v3 string for workbench products.
    if engine_version.startswith('boxcraft.knife'):
        engine_version = DEFAULT_ENGINE_VERSION

    return {
        'template_key': template_key,
        'template_version': ver.version if ver else '1',
        'engine_version': engine_version,
        'default_params': defaults,
        'limits': {'basis': 'inner', **{k: v for k, v in limits.items() if k != 'basis'}},
        'material_ids': list(material_ids),
        'engineering_domain': serialize_engineering_domain(template_key),
        'tiers': list(tiers),
        'advanced_requires_plan': bool(caps.get('advanced_requires_plan', False)),
        'server_only': bool(caps.get('server_only', False)),
    }
