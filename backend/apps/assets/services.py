from __future__ import annotations

import hashlib
import io
import logging
import struct
import uuid
from pathlib import Path

from django.conf import settings
from django.db import transaction

from apps.assets.models import Asset, AssetDerivative
from apps.assets.preview import THUMB_KIND

logger = logging.getLogger(__name__)

ALLOWED_MIME = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
}
# Server-generated exports only (not accepted via user upload).
EXPORT_MIME = {
    'image/svg+xml': '.svg',
    'application/dxf': '.dxf',
    'application/pdf': '.pdf',
}
MAX_BYTES = 15 * 1024 * 1024
MAX_EXPORT_BYTES = 40 * 1024 * 1024
THUMB_MAX_EDGE = 256


class AssetUploadError(Exception):
    def __init__(self, message, code='ASSET_UPLOAD_ERROR'):
        super().__init__(message)
        self.code = code


def _png_size(data: bytes):
    if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n':
        return None, None
    width, height = struct.unpack('>II', data[16:24])
    return width, height


def _jpeg_size(data: bytes):
    if len(data) < 4 or data[:2] != b'\xff\xd8':
        return None, None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack('>HH', data[i + 5 : i + 9])
            return width, height
        length = struct.unpack('>H', data[i + 2 : i + 4])[0]
        i += 2 + length
    return None, None


def detect_image_size(mime: str, data: bytes):
    if mime == 'image/png':
        w, h = _png_size(data)
        if w and h:
            return w, h
    if mime == 'image/jpeg':
        w, h = _jpeg_size(data)
        if w and h:
            return w, h
    try:
        from PIL import Image

        with Image.open(io.BytesIO(data)) as img:
            return img.size[0], img.size[1]
    except Exception:  # noqa: BLE001
        return None, None


def absolute_path(asset: Asset) -> Path:
    return Path(settings.MEDIA_ROOT) / asset.storage_key


def derivative_absolute_path(derivative: AssetDerivative) -> Path:
    return Path(settings.MEDIA_ROOT) / derivative.storage_key


def store_derivative_bytes(
    *,
    asset: Asset,
    kind: str,
    data: bytes,
    mime: str,
    params: dict | None = None,
) -> AssetDerivative:
    if not data:
        raise AssetUploadError('empty derivative', code='EMPTY_FILE')
    ext = '.webp' if mime == 'image/webp' else '.bin'
    rel = (
        Path('orgs')
        / str(asset.organization_id)
        / 'assets'
        / 'derivatives'
        / str(asset.id)
        / f'{kind}{ext}'
    )
    abs_path = Path(settings.MEDIA_ROOT) / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(data)
    storage_key = str(rel).replace('\\', '/')
    existing = AssetDerivative.objects.filter(asset=asset, kind=kind).first()
    if existing:
        existing.storage_key = storage_key
        existing.mime = mime
        existing.params = params or {}
        existing.save(update_fields=['storage_key', 'mime', 'params'])
        return existing
    return AssetDerivative.objects.create(
        asset=asset,
        kind=kind,
        storage_key=storage_key,
        mime=mime,
        params=params or {},
    )


def enqueue_thumbnail(asset_id: str) -> None:
    from apps.assets.tasks import generate_thumbnail

    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        generate_thumbnail(str(asset_id))
        return
    transaction.on_commit(lambda: generate_thumbnail.delay(str(asset_id)))


def enqueue_missing_thumbnails_for_content(content: dict) -> None:
    from apps.assets.preview import resolve_revision_preview_asset_id

    # Prefer all image layers, not only first preview
    artwork = content.get('artwork') if isinstance(content.get('artwork'), dict) else {}
    layers = artwork.get('layers') if isinstance(artwork.get('layers'), list) else []
    ids: list[str] = []
    for layer in layers:
        if isinstance(layer, dict) and layer.get('kind') == 'image' and layer.get('assetId'):
            ids.append(str(layer['assetId']))
    # Also ensure preview helper path assets are covered
    preview = resolve_revision_preview_asset_id(content)
    if preview:
        ids.append(preview)
    uniq = list(dict.fromkeys(ids))
    if not uniq:
        return
    ready_ids = set(
        str(x)
        for x in Asset.objects.filter(
            id__in=uniq,
            status=Asset.Status.READY,
            mime__in=ALLOWED_MIME.keys(),
        ).values_list('id', flat=True)
    )
    have = set(
        str(x)
        for x in AssetDerivative.objects.filter(asset_id__in=ready_ids, kind=THUMB_KIND).values_list(
            'asset_id', flat=True
        )
    )
    for aid in ready_ids:
        if aid not in have:
            enqueue_thumbnail(aid)


def render_thumbnail_bytes(asset: Asset) -> bytes:
    path = absolute_path(asset)
    if not path.exists():
        raise AssetUploadError('source missing', code='ASSET_MISSING')
    from PIL import Image

    with Image.open(path) as img:
        img = img.convert('RGBA') if img.mode in ('P', 'RGBA', 'LA') else img.convert('RGB')
        img.thumbnail((THUMB_MAX_EDGE, THUMB_MAX_EDGE), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        save_img = img
        if save_img.mode == 'RGBA':
            save_img.save(buf, format='WEBP', quality=80, method=4)
        else:
            save_img.save(buf, format='WEBP', quality=80, method=4)
        return buf.getvalue()


@transaction.atomic
def store_upload(*, organization, owner, uploaded_file) -> Asset:
    mime = uploaded_file.content_type or ''
    if mime not in ALLOWED_MIME:
        raise AssetUploadError('unsupported mime type', code='UNSUPPORTED_MIME')
    data = uploaded_file.read()
    if not data:
        raise AssetUploadError('empty file', code='EMPTY_FILE')
    if len(data) > MAX_BYTES:
        raise AssetUploadError('file too large', code='FILE_TOO_LARGE')

    digest = hashlib.sha256(data).hexdigest()
    width, height = detect_image_size(mime, data)
    asset_id = uuid.uuid4()
    rel = Path('orgs') / str(organization.id) / 'assets' / f'{asset_id}{ALLOWED_MIME[mime]}'
    abs_path = Path(settings.MEDIA_ROOT) / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(data)

    asset = Asset.objects.create(
        id=asset_id,
        organization=organization,
        owner=owner,
        storage_key=str(rel).replace('\\', '/'),
        original_filename=getattr(uploaded_file, 'name', '')[:255],
        mime=mime,
        byte_size=len(data),
        sha256=digest,
        width_px=width,
        height_px=height,
        status=Asset.Status.READY,
        source='upload',
    )

    from apps.designs.models import OutboxEvent

    OutboxEvent.objects.create(
        event_type='asset.thumbnail_requested',
        payload={'asset_id': str(asset.id), 'organization_id': str(organization.id)},
    )
    enqueue_thumbnail(str(asset.id))
    return asset


@transaction.atomic
def store_bytes(
    *,
    organization,
    owner,
    data: bytes,
    mime: str,
    filename: str,
    source: str = 'export',
    meta: dict | None = None,
) -> Asset:
    mime = (mime or '').strip().lower()
    if mime not in EXPORT_MIME:
        raise AssetUploadError('unsupported export mime type', code='UNSUPPORTED_MIME')
    if not data:
        raise AssetUploadError('empty file', code='EMPTY_FILE')
    if len(data) > MAX_EXPORT_BYTES:
        raise AssetUploadError('file too large', code='FILE_TOO_LARGE')

    digest = hashlib.sha256(data).hexdigest()
    asset_id = uuid.uuid4()
    rel = Path('orgs') / str(organization.id) / 'exports' / f'{asset_id}{EXPORT_MIME[mime]}'
    abs_path = Path(settings.MEDIA_ROOT) / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(data)

    return Asset.objects.create(
        id=asset_id,
        organization=organization,
        owner=owner,
        storage_key=str(rel).replace('\\', '/'),
        original_filename=(filename or f'export{EXPORT_MIME[mime]}')[:255],
        mime=mime,
        byte_size=len(data),
        sha256=digest,
        width_px=None,
        height_px=None,
        status=Asset.Status.READY,
        source=source,
        meta=meta or {},
    )
