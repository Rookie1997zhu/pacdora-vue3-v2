from __future__ import annotations

import copy
import json
from pathlib import Path

from django.conf import settings


SCHEMA_VERSION = 'boxcraft.render_scene.v2'
SCHEMA_VERSION_V1 = 'boxcraft.render_scene.v1'

LIGHT_PRESETS = {
    'softbox': {'sunPhi': 45, 'sunTheta': 35, 'sunIntensity': 1.6, 'envIntensity': 0.85},
    'daylight': {'sunPhi': 55, 'sunTheta': 140, 'sunIntensity': 2.2, 'envIntensity': 0.7},
    'warm': {'sunPhi': 40, 'sunTheta': 210, 'sunIntensity': 1.8, 'envIntensity': 0.9},
}


class SceneValidationError(Exception):
    def __init__(self, message: str, errors=None):
        super().__init__(message)
        self.errors = errors or {}


def _schema_candidates(name: str) -> list[Path]:
    env = (getattr(settings, 'RENDER_SCENE_SCHEMA_PATH', None) or '').strip()
    paths: list[Path] = []
    if env:
        env_path = Path(env)
        if env_path.name == name:
            paths.append(env_path)
        else:
            paths.append(env_path.parent / name)
    paths.extend(
        [
            Path(settings.BASE_DIR).parent / 'packages' / 'render-scene-schema' / name,
            Path('/packages/render-scene-schema') / name,
            Path(__file__).resolve().parents[3] / 'packages' / 'render-scene-schema' / name,
        ]
    )
    return paths


def _resolve_schema_path(version: str | None = None) -> Path:
    name = 'render-scene.v2.schema.json'
    if version == SCHEMA_VERSION_V1:
        name = 'render-scene.v1.schema.json'
    for path in _schema_candidates(name):
        if path.is_file():
            return path
    return _schema_candidates(name)[0]


def _load_schema(version: str | None = None):
    path = _resolve_schema_path(version)
    if not path.is_file():
        raise SceneValidationError(f'render scene schema missing: {path}')
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def create_default_scene() -> dict:
    light = LIGHT_PRESETS['softbox']
    return {
        'schemaVersion': SCHEMA_VERSION,
        'templateId': None,
        'camera': {
            'position': {'x': 420, 'y': 320, 'z': 420},
            'target': {'x': 0, 'y': 40, 'z': 0},
            'fov': 38,
        },
        'light': {
            'preset': 'softbox',
            'sunPhi': light['sunPhi'],
            'sunTheta': light['sunTheta'],
            'sunIntensity': light['sunIntensity'],
            'envIntensity': light['envIntensity'],
        },
        'background': {
            'type': 'solid',
            'color': '#F5F6F8',
            'gradient': {'top': '#EEF1F5', 'bottom': '#D8DEE8'},
        },
        'ground': {'visible': True, 'shadowIntensity': 0.45},
        'output': {'aspect': '1:1'},
        'environment': {
            'hdrId': None,
            'intensity': 1.0,
            'rotation': 0.0,
            'useAsBackground': False,
        },
        'models': [],
        'props': [],
        'views': [],
    }


def upgrade_scene_to_v2(content: dict) -> dict:
    """Upgrade v1 (or partial) content to v2 shape without dropping known fields."""
    base = create_default_scene()
    if not isinstance(content, dict):
        return base
    out = copy.deepcopy(base)
    for key in ('camera', 'light', 'background', 'ground', 'output'):
        if isinstance(content.get(key), dict):
            out[key] = copy.deepcopy(content[key])
    if isinstance(content.get('models'), list):
        out['models'] = copy.deepcopy(content['models'])
    if isinstance(content.get('props'), list):
        out['props'] = copy.deepcopy(content['props'])
    if isinstance(content.get('views'), list):
        out['views'] = copy.deepcopy(content['views'])
    if isinstance(content.get('environment'), dict):
        env = copy.deepcopy(base['environment'])
        env.update(content['environment'])
        out['environment'] = env
    if 'templateId' in content:
        out['templateId'] = content.get('templateId')
    out['schemaVersion'] = SCHEMA_VERSION
    return out


def validate_render_scene(content: dict) -> dict:
    if not isinstance(content, dict):
        raise SceneValidationError('content must be object')
    try:
        import jsonschema
    except ImportError as exc:  # pragma: no cover
        raise SceneValidationError('jsonschema missing') from exc

    version = str(content.get('schemaVersion') or '')
    if version == SCHEMA_VERSION_V1:
        content = upgrade_scene_to_v2(content)
        version = SCHEMA_VERSION
    elif version != SCHEMA_VERSION:
        # Accept missing/legacy by upgrading then validating as v2.
        content = upgrade_scene_to_v2(content)
        version = SCHEMA_VERSION

    # Combined object cap
    models = content.get('models') if isinstance(content.get('models'), list) else []
    props = content.get('props') if isinstance(content.get('props'), list) else []
    if len(models) + len(props) > 30:
        raise SceneValidationError(
            'too many models+props',
            errors={'root': ['models+props exceed 30']},
        )

    schema = _load_schema(SCHEMA_VERSION)
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(content), key=lambda e: list(e.path))
    packed = {}
    if errors:
        for err in errors[:30]:
            path = '.'.join(str(p) for p in err.path) or 'root'
            packed.setdefault(path, []).append(err.message)
        raise SceneValidationError('render scene invalid', errors=packed)
    return content


def collect_design_ids(content: dict) -> list[str]:
    ids = []
    for model in content.get('models') or []:
        if isinstance(model, dict) and model.get('designId'):
            ids.append(str(model['designId']))
    return ids


def collect_prop_refs(content: dict) -> list[dict]:
    refs = []
    for prop in content.get('props') or []:
        if isinstance(prop, dict) and prop.get('propId'):
            refs.append(
                {
                    'propId': str(prop['propId']),
                    'source': str(prop.get('source') or 'official'),
                    'assetId': str(prop['assetId']) if prop.get('assetId') else None,
                }
            )
    return refs
