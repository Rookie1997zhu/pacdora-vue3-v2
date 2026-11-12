from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

from apps.assets.preview import THUMB_KIND

logger = logging.getLogger(__name__)


@shared_task(name='assets.generate_thumbnail', bind=True, max_retries=3, queue='media')
def generate_thumbnail(self, asset_id: str, force: bool = False):
    from apps.assets.models import Asset, AssetDerivative
    from apps.assets.services import (
        AssetUploadError,
        absolute_path,
        derivative_absolute_path,
        render_thumbnail_bytes,
        store_derivative_bytes,
    )
    from apps.designs.models import OutboxEvent

    try:
        asset = Asset.objects.filter(pk=asset_id).first()
        if not asset or asset.status != Asset.Status.READY:
            return {'asset_id': asset_id, 'skipped': 'not_ready'}
        if asset.mime not in ('image/png', 'image/jpeg', 'image/webp'):
            return {'asset_id': asset_id, 'skipped': 'unsupported_mime'}

        existing = AssetDerivative.objects.filter(asset=asset, kind=THUMB_KIND).first()
        if existing and derivative_absolute_path(existing).exists() and not force:
            return {'asset_id': asset_id, 'skipped': 'exists'}
        if existing and force:
            path = derivative_absolute_path(existing)
            if path.exists():
                path.unlink(missing_ok=True)
            existing.delete()

        data = render_thumbnail_bytes(asset)
        store_derivative_bytes(
            asset=asset,
            kind=THUMB_KIND,
            data=data,
            mime='image/webp',
            params={'max': 256},
        )
        aid = str(asset.id)
        for ev in OutboxEvent.objects.filter(
            event_type='asset.thumbnail_requested',
            status=OutboxEvent.Status.PENDING,
        ):
            if (ev.payload or {}).get('asset_id') == aid:
                ev.status = OutboxEvent.Status.SENT
                ev.sent_at = timezone.now()
                ev.save(update_fields=['status', 'sent_at'])
        return {'asset_id': asset_id, 'ok': True, 'bytes': len(data), 'source': absolute_path(asset).name}
    except AssetUploadError as exc:
        logger.warning('thumbnail failed %s: %s', asset_id, exc)
        return {'asset_id': asset_id, 'error': exc.code}
    except Exception as exc:  # noqa: BLE001
        logger.exception('thumbnail crashed %s', asset_id)
        raise self.retry(exc=exc, countdown=5)
