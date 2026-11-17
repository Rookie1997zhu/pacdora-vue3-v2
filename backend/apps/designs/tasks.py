from __future__ import annotations

import logging
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.db import transaction

from apps.assets.models import Asset, AssetDerivative
from apps.designs.models import Design, DesignRevision
from apps.geometry_api.client import GeometryServiceError, render_thumbnail

logger = logging.getLogger(__name__)

DIELINE_KIND = 'dieline_svg'


def _ensure_dieline_asset(design: Design, revision: DesignRevision) -> Asset:
    if design.dieline_preview_asset_id:
        asset = design.dieline_preview_asset
        if asset and asset.status != Asset.Status.DELETED:
            return asset
    # Placeholder storage key; overwritten when SVG is written.
    rel = Path('orgs') / str(design.organization_id) / 'assets' / 'dieline' / f'{design.id}.svg'
    abs_path = Path(settings.MEDIA_ROOT) / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    if not abs_path.exists():
        abs_path.write_text('<svg xmlns="http://www.w3.org/2000/svg"/>', encoding='utf-8')
    asset = Asset.objects.create(
        organization_id=design.organization_id,
        owner_id=design.owner_id,
        storage_key=str(rel).replace('\\', '/'),
        original_filename=f'dieline-{design.id}.svg',
        mime='image/svg+xml',
        byte_size=abs_path.stat().st_size,
        status=Asset.Status.READY,
        source='dieline_thumbnail',
        meta={'design_id': str(design.id), 'revision_id': str(revision.id)},
    )
    design.dieline_preview_asset = asset
    design.save(update_fields=['dieline_preview_asset', 'updated_at'])
    return asset


@shared_task(name='designs.render_dieline_thumbnail', bind=True, max_retries=2, queue='media')
def render_dieline_thumbnail(self, design_id: str, revision_id: str):
    rev = (
        DesignRevision.objects.select_related('design', 'design__owner', 'design__dieline_preview_asset')
        .filter(id=revision_id, design_id=design_id)
        .first()
    )
    if not rev:
        return {'ok': False, 'reason': 'revision_missing'}
    content = rev.content_json or {}
    geom = content.get('geometry') or {}
    params = geom.get('params') or {}
    if not geom.get('templateId'):
        return {'ok': False, 'reason': 'no_template'}
    try:
        data = render_thumbnail(
            {
                'template_id': geom['templateId'],
                'length_mm': params.get('lengthMm'),
                'width_mm': params.get('widthMm'),
                'height_mm': params.get('heightMm'),
                'thickness_mm': params.get('thicknessMm'),
                'bleed_mm': params.get('bleedInputMm', 3),
                'size_mode': params.get('sizeMode') or 'inner',
                'flute_direction': params.get('fluteDirection') or 'L',
                'material_id': params.get('materialId') or 'kraft',
                'params': params.get('advanced') or {},
            }
        )
    except GeometryServiceError as exc:
        logger.warning('dieline thumbnail geometry failed %s: %s', revision_id, exc)
        raise self.retry(exc=exc, countdown=5) from exc

    svg = data.get('svg') or ''
    if not svg:
        return {'ok': False, 'reason': 'empty_svg'}
    svg_bytes = svg.encode('utf-8')

    with transaction.atomic():
        design = Design.objects.select_for_update().get(pk=design_id)
        asset = _ensure_dieline_asset(design, rev)
        rel = Path('orgs') / str(design.organization_id) / 'assets' / 'derivatives' / str(asset.id) / 'dieline_svg.svg'
        abs_path = Path(settings.MEDIA_ROOT) / rel
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_bytes(svg_bytes)
        storage_key = str(rel).replace('\\', '/')
        existing = AssetDerivative.objects.filter(asset=asset, kind=DIELINE_KIND).first()
        if existing:
            existing.storage_key = storage_key
            existing.mime = 'image/svg+xml'
            existing.params = {'revision_id': str(rev.id), 'geometry_hash': rev.geometry_hash}
            existing.save(update_fields=['storage_key', 'mime', 'params'])
        else:
            AssetDerivative.objects.create(
                asset=asset,
                kind=DIELINE_KIND,
                storage_key=storage_key,
                mime='image/svg+xml',
                params={'revision_id': str(rev.id), 'geometry_hash': rev.geometry_hash},
            )
        asset.byte_size = len(svg_bytes)
        asset.storage_key = storage_key
        asset.meta = {**(asset.meta or {}), 'design_id': str(design.id), 'revision_id': str(rev.id)}
        asset.save(update_fields=['byte_size', 'storage_key', 'meta', 'updated_at'])
    return {'ok': True, 'design_id': design_id, 'revision_id': revision_id, 'bytes': len(svg_bytes)}
