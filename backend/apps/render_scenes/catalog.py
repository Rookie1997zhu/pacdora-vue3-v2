from __future__ import annotations

import struct
import uuid

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.assets.services import store_prop_glb, store_render_hdr
from apps.organizations.models import Organization
from apps.render_scenes.document import create_default_scene
from apps.render_scenes.glb import validate_glb
from apps.render_scenes.models import RenderEnvironment, RenderProp, RenderSceneTemplate

CATALOG_ORG_SLUG = 'boxcraft-catalog'
CATALOG_OWNER_EMAIL = 'catalog@boxcraft.local'


def get_or_create_catalog_org():
    org, _ = Organization.objects.get_or_create(
        slug=CATALOG_ORG_SLUG,
        defaults={'name': 'BOXCRAFT Catalog'},
    )
    User = get_user_model()
    owner = User.objects.filter(email=CATALOG_OWNER_EMAIL).first()
    if not owner:
        owner = User.objects.create_user(
            email=CATALOG_OWNER_EMAIL,
            password=uuid.uuid4().hex,
            is_active=False,
        )
    return org, owner


def _minimal_glb() -> bytes:
    import json

    gltf = {
        'asset': {'version': '2.0'},
        'scenes': [{'nodes': [0]}],
        'scene': 0,
        'nodes': [{'mesh': 0, 'name': 'Pedestal'}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0}}]}],
        'accessors': [
            {
                'bufferView': 0,
                'componentType': 5126,
                'count': 3,
                'type': 'VEC3',
                'max': [1, 1, 0],
                'min': [0, 0, 0],
            }
        ],
        'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 36}],
        'buffers': [{'byteLength': 36}],
    }
    json_bytes = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    while len(json_bytes) % 4:
        json_bytes += b' '
    bin_bytes = b'\x00' * 36
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    header = struct.pack('<4sII', b'glTF', 2, total)
    json_chunk = struct.pack('<I4s', len(json_bytes), b'JSON') + json_bytes
    bin_chunk = struct.pack('<I4s', len(bin_bytes), b'BIN\x00') + bin_bytes
    return header + json_chunk + bin_chunk


def _flat_hdr(*, width: int = 64, height: int = 32, rgb=(0.85, 0.88, 0.95)) -> bytes:
    """Minimal Radiance RGBE HDR (uncompressed scanlines)."""
    r, g, b = rgb
    # Convert float RGB to RGBE
    import math

    def to_rgbe(fr, fg, fb):
        v = max(fr, fg, fb)
        if v < 1e-32:
            return bytes((0, 0, 0, 0))
        exp = int(math.floor(math.log2(v)) + 1)
        scale = 256.0 / (2**exp)
        return bytes(
            (
                min(255, int(fr * scale)),
                min(255, int(fg * scale)),
                min(255, int(fb * scale)),
                exp + 128,
            )
        )

    pixel = to_rgbe(r, g, b)
    header = (
        b'#?RADIANCE\n'
        b'FORMAT=32-bit_rle_rgbe\n'
        b'\n'
        + f'-Y {height} +X {width}\n'.encode('ascii')
    )
    body = pixel * (width * height)
    return header + body


def _template_content(*, name: str, slot: str = 'main', prop_slug: str | None = None) -> dict:
    doc = create_default_scene()
    doc['models'] = [
        {
            'id': str(uuid.uuid4()),
            'slotId': slot,
            'designId': '00000000-0000-4000-8000-000000000001',
            'revisionId': None,
            'name': f'{name} slot',
            'position': {'x': 0, 'y': 0, 'z': 0},
            'rotation': {'x': 0, 'y': 0.35, 'z': 0},
            'scale': 1,
            'foldProgress': 100,
            'materialId': 'kraft',
        }
    ]
    if prop_slug:
        prop = RenderProp.objects.filter(is_official=True, slug=prop_slug).first()
        if prop:
            doc['props'] = [
                {
                    'id': str(uuid.uuid4()),
                    'source': 'official',
                    'propId': str(prop.id),
                    'assetId': str(prop.asset_id),
                    'name': prop.name,
                    'position': {'x': 0, 'y': 0, 'z': 0},
                    'rotation': {'x': 0, 'y': 0, 'z': 0},
                    'scale': 1.2,
                }
            ]
    doc['environment'] = {
        'hdrId': 'studio_soft',
        'intensity': 1.0,
        'rotation': 0,
        'useAsBackground': False,
    }
    doc['views'] = [
        {
            'id': str(uuid.uuid4()),
            'name': 'Hero',
            'camera': {
                'position': {'x': 420, 'y': 320, 'z': 420},
                'target': {'x': 0, 'y': 40, 'z': 0},
                'fov': 38,
            },
            'output': {'aspect': '1:1'},
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Side',
            'camera': {
                'position': {'x': 520, 'y': 180, 'z': 40},
                'target': {'x': 0, 'y': 40, 'z': 0},
                'fov': 35,
            },
            'output': {'aspect': '4:3'},
        },
    ]
    return doc


@transaction.atomic
def seed_render_catalog(*, force: bool = False) -> dict:
    org, owner = get_or_create_catalog_org()
    created = {'props': 0, 'environments': 0, 'templates': 0}

    glb = _minimal_glb()
    validate_glb(glb)

    prop_defs = [
        ('pedestal', '底座'),
        ('stand_plane', '展示台面'),
        ('shadow_disc', '阴影圆盘'),
    ]
    for slug, name in prop_defs:
        existing = RenderProp.objects.filter(is_official=True, slug=slug).first()
        if existing and not force:
            continue
        asset = store_prop_glb(
            organization=org,
            owner=owner,
            data=glb,
            filename=f'{slug}.glb',
            meta={'official': True, 'slug': slug},
        )
        if existing:
            existing.asset = asset
            existing.name = name
            existing.save(update_fields=['asset', 'name', 'updated_at'])
        else:
            RenderProp.objects.create(
                organization=None,
                owner=None,
                name=name,
                slug=slug,
                source=RenderProp.Source.OFFICIAL,
                is_official=True,
                asset=asset,
            )
            created['props'] += 1

    hdr_defs = [
        ('studio_soft', '柔光棚', (0.92, 0.93, 0.95)),
        ('daylight_sky', '日光天空', (0.55, 0.72, 1.0)),
        ('warm_interior', '暖色室内', (1.0, 0.78, 0.55)),
    ]
    for idx, (env_id, name, rgb) in enumerate(hdr_defs):
        existing = RenderEnvironment.objects.filter(pk=env_id).first()
        if existing and not force:
            continue
        hdr = _flat_hdr(rgb=rgb)
        asset = store_render_hdr(
            organization=org,
            owner=owner,
            data=hdr,
            filename=f'{env_id}.hdr',
            meta={'official': True, 'hdr_id': env_id},
        )
        if existing:
            existing.asset = asset
            existing.name = name
            existing.default_intensity = 1.0
            existing.sort_order = idx
            existing.save(update_fields=['asset', 'name', 'default_intensity', 'sort_order', 'updated_at'])
        else:
            RenderEnvironment.objects.create(
                id=env_id,
                name=name,
                asset=asset,
                default_intensity=1.0,
                sort_order=idx,
            )
            created['environments'] += 1

    template_defs = [
        ('tilt_box', '倾斜盒子', 'basic', 'pedestal'),
        ('front_hero', '正面主视觉', 'basic', 'stand_plane'),
        ('studio_pack', '柔光棚组合', 'advanced', 'shadow_disc'),
    ]
    for idx, (tid, name, tier, prop_slug) in enumerate(template_defs):
        existing = RenderSceneTemplate.objects.filter(pk=tid).first()
        if existing and not force:
            continue
        content = _template_content(name=name, slot='main', prop_slug=prop_slug)
        if existing:
            existing.name = name
            existing.tier = tier
            existing.content_json = content
            existing.slot_ids = ['main']
            existing.sort_order = idx
            existing.save(
                update_fields=['name', 'tier', 'content_json', 'slot_ids', 'sort_order', 'updated_at']
            )
        else:
            RenderSceneTemplate.objects.create(
                id=tid,
                name=name,
                tier=tier,
                content_json=content,
                slot_ids=['main'],
                sort_order=idx,
            )
            created['templates'] += 1

    return created
