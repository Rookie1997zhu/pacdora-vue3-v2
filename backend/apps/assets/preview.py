from __future__ import annotations

from apps.assets.models import Asset, AssetDerivative

THUMB_KIND = 'thumb_256'


def resolve_revision_preview_asset_id(content_json) -> str | None:
    """First READY image layer assetId in revision content (preview only)."""
    if not isinstance(content_json, dict):
        return None
    artwork = content_json.get('artwork') if isinstance(content_json.get('artwork'), dict) else {}
    layers = artwork.get('layers') if isinstance(artwork.get('layers'), list) else []
    candidates: list[str] = []
    for layer in layers:
        if not isinstance(layer, dict):
            continue
        if layer.get('kind') != 'image':
            continue
        aid = layer.get('assetId')
        if aid:
            candidates.append(str(aid))
    if not candidates:
        return None
    ready = set(
        str(x)
        for x in Asset.objects.filter(
            id__in=candidates,
            status=Asset.Status.READY,
            mime__in=('image/png', 'image/jpeg', 'image/webp'),
        ).values_list('id', flat=True)
    )
    for aid in candidates:
        if aid in ready:
            return aid
    return None


def asset_thumbnail_ready(asset_id: str | None) -> bool:
    if not asset_id:
        return False
    return AssetDerivative.objects.filter(asset_id=asset_id, kind=THUMB_KIND).exists()


def preview_fields_for_content(content_json) -> dict:
    preview_id = resolve_revision_preview_asset_id(content_json)
    return {
        'preview_asset_id': preview_id,
        'thumbnail_ready': asset_thumbnail_ready(preview_id),
    }
