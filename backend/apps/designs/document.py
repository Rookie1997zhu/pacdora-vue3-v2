from __future__ import annotations

import hashlib
import json
from pathlib import Path

from django.conf import settings


def _resolve_schema_path() -> Path:
    """Locate design-document schema in monorepo or container layouts."""
    name = 'design-document.v1.schema.json'
    env = (getattr(settings, 'DESIGN_DOCUMENT_SCHEMA_PATH', None) or '').strip()
    if env:
        return Path(env)
    candidates = [
        Path(settings.BASE_DIR).parent / 'packages' / 'design-schema' / name,
        Path('/packages/design-schema') / name,
        Path(__file__).resolve().parents[3] / 'packages' / 'design-schema' / name,
    ]
    for path in candidates:
        if path.is_file():
            return path
    return candidates[0]


SCHEMA_PATH = _resolve_schema_path()


class DocumentValidationError(Exception):
    def __init__(self, message: str, errors=None):
        super().__init__(message)
        self.errors = errors or {}


def _load_schema():
    path = _resolve_schema_path()
    if not path.is_file():
        raise DocumentValidationError(f'design schema missing: {path}')
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def _validate_layer_semantics(layer: dict, index: int, packed: dict):
    kind = layer.get('kind')
    prefix = f'artwork.layers[{index}]'
    if kind == 'image':
        if not layer.get('assetId'):
            packed.setdefault(f'{prefix}.assetId', []).append('image layer requires assetId')
        crop = layer.get('crop')
        if isinstance(crop, dict):
            x, y, w, h = crop.get('x'), crop.get('y'), crop.get('w'), crop.get('h')
            try:
                if float(x) + float(w) > 1.0001 or float(y) + float(h) > 1.0001:
                    packed.setdefault(f'{prefix}.crop', []).append('crop box must stay within [0,1]')
            except (TypeError, ValueError):
                packed.setdefault(f'{prefix}.crop', []).append('invalid crop numbers')
    elif kind == 'text':
        text = layer.get('text')
        if not isinstance(text, dict):
            packed.setdefault(f'{prefix}.text', []).append('text layer requires text object')
        else:
            for key in ('content', 'fontFamily', 'fontSizeMm', 'fill', 'align'):
                if key not in text or text.get(key) in (None, ''):
                    packed.setdefault(f'{prefix}.text.{key}', []).append('required')
    elif kind == 'shape':
        shape = layer.get('shape')
        if not isinstance(shape, dict):
            packed.setdefault(f'{prefix}.shape', []).append('shape layer requires shape object')
        else:
            if shape.get('shapeType') not in ('rect', 'ellipse'):
                packed.setdefault(f'{prefix}.shape.shapeType', []).append('must be rect|ellipse')
            for key in ('fill', 'stroke', 'strokeWidthMm'):
                if key not in shape:
                    packed.setdefault(f'{prefix}.shape.{key}', []).append('required')

    asset_id = layer.get('assetId')
    if isinstance(asset_id, str) and asset_id.startswith(('blob:', 'http://', 'https://', 'data:')):
        packed.setdefault(f'{prefix}.assetId', []).append('assetId must be private UUID, not URL')


def validate_design_document(content: dict) -> dict:
    if not isinstance(content, dict):
        raise DocumentValidationError('content must be object')
    try:
        import jsonschema
    except ImportError as exc:  # pragma: no cover
        raise DocumentValidationError('jsonschema missing') from exc

    schema = _load_schema()
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(content), key=lambda e: list(e.path))
    packed = {}
    if errors:
        for err in errors[:20]:
            path = '.'.join(str(p) for p in err.path) or 'root'
            packed.setdefault(path, []).append(err.message)

    layers = content.get('artwork', {}).get('layers') or []
    for i, layer in enumerate(layers):
        if isinstance(layer, dict):
            _validate_layer_semantics(layer, i, packed)

    if packed:
        raise DocumentValidationError('design document invalid', errors=packed)
    return content


def content_hash(content: dict) -> str:
    canonical = json.dumps(content, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def request_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()
