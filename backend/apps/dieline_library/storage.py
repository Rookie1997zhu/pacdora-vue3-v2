from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

from django.conf import settings
from django.db import transaction

from apps.assets.models import Asset
from apps.assets.services import AssetUploadError

DIELINE_MIME = {
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'application/dxf': '.dxf',
}
MAX_DIELINE_BYTES = 40 * 1024 * 1024


@transaction.atomic
def store_dieline_bytes(
    *,
    organization,
    owner,
    data: bytes,
    mime: str,
    filename: str,
    meta: dict | None = None,
) -> Asset:
    mime = (mime or '').strip().lower()
    if mime not in DIELINE_MIME:
        raise AssetUploadError('unsupported dieline mime type', code='UNSUPPORTED_MIME')
    if not data:
        raise AssetUploadError('empty file', code='EMPTY_FILE')
    if len(data) > MAX_DIELINE_BYTES:
        raise AssetUploadError('file too large', code='FILE_TOO_LARGE')

    digest = hashlib.sha256(data).hexdigest()
    existing = Asset.objects.filter(
        organization=organization,
        sha256=digest,
        source='dieline_library',
        status=Asset.Status.READY,
    ).first()
    if existing:
        return existing

    asset_id = uuid.uuid4()
    rel = Path('orgs') / str(organization.id) / 'dielines' / f'{asset_id}{DIELINE_MIME[mime]}'
    abs_path = Path(settings.MEDIA_ROOT) / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(data)

    return Asset.objects.create(
        id=asset_id,
        organization=organization,
        owner=owner,
        storage_key=str(rel).replace('\\', '/'),
        original_filename=(filename or f'dieline{DIELINE_MIME[mime]}')[:255],
        mime=mime,
        byte_size=len(data),
        sha256=digest,
        width_px=None,
        height_px=None,
        status=Asset.Status.READY,
        source='dieline_library',
        meta=meta or {},
    )
