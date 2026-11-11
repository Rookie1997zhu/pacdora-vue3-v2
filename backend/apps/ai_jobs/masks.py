from __future__ import annotations

import io
import math

from apps.ai_jobs.errors import AiJobError

MAX_RINGS = 64
MAX_COORDS_PER_RING = 4096
MAX_EDGE_PX_CAP = 2048


def _as_bbox(raw) -> dict:
    if not isinstance(raw, dict):
        raise AiJobError('registration.netBoundingBoxMm invalid', code='VALIDATION_ERROR', status=400)
    try:
        min_x = float(raw['minX'])
        min_y = float(raw['minY'])
        width = float(raw['widthMm'])
        height = float(raw['heightMm'])
    except (KeyError, TypeError, ValueError) as exc:
        raise AiJobError('registration.netBoundingBoxMm invalid', code='VALIDATION_ERROR', status=400) from exc
    if width <= 0 or height <= 0:
        raise AiJobError('registration bbox size must be positive', code='VALIDATION_ERROR', status=400)
    return {'minX': min_x, 'minY': min_y, 'widthMm': width, 'heightMm': height}


def _as_rings(raw, *, field: str) -> list[list[float]]:
    if not isinstance(raw, list) or not raw:
        raise AiJobError(f'registration.{field} required', code='VALIDATION_ERROR', status=400)
    if len(raw) > MAX_RINGS:
        raise AiJobError(f'registration.{field} too many rings', code='VALIDATION_ERROR', status=400)
    rings: list[list[float]] = []
    for ring in raw:
        if not isinstance(ring, list) or len(ring) < 6 or len(ring) % 2 != 0:
            raise AiJobError(f'registration.{field} ring invalid', code='VALIDATION_ERROR', status=400)
        if len(ring) > MAX_COORDS_PER_RING:
            raise AiJobError(f'registration.{field} ring too large', code='VALIDATION_ERROR', status=400)
        try:
            coords = [float(x) for x in ring]
        except (TypeError, ValueError) as exc:
            raise AiJobError(f'registration.{field} ring invalid', code='VALIDATION_ERROR', status=400) from exc
        rings.append(coords)
    return rings


def validate_registration_payload(registration, *, expected_geometry_hash: str | None = None) -> dict:
    if not isinstance(registration, dict):
        raise AiJobError('registration must be an object', code='VALIDATION_ERROR', status=400)
    geometry_hash = str(registration.get('geometryHash') or '').strip()
    if not geometry_hash:
        raise AiJobError('registration.geometryHash required', code='VALIDATION_ERROR', status=400)
    if expected_geometry_hash is not None and geometry_hash != str(expected_geometry_hash):
        raise AiJobError(
            'registration geometryHash does not match current revision',
            code='GEOMETRY_MISMATCH',
            status=400,
        )
    bbox = _as_bbox(registration.get('netBoundingBoxMm'))
    try:
        px_per_mm = float(registration.get('pxPerMm') or 4)
        max_edge = float(registration.get('maxEdgePx') or 1024)
    except (TypeError, ValueError) as exc:
        raise AiJobError('registration scale invalid', code='VALIDATION_ERROR', status=400) from exc
    if px_per_mm <= 0 or max_edge <= 0:
        raise AiJobError('registration scale invalid', code='VALIDATION_ERROR', status=400)
    max_edge = min(max_edge, MAX_EDGE_PX_CAP)
    main_mask = _as_rings(registration.get('mainMask'), field='mainMask')
    mask_hash = str(registration.get('maskHash') or '').strip()
    return {
        'geometryHash': geometry_hash,
        'maskHash': mask_hash,
        'polarity': str(registration.get('polarity') or 'white_printable'),
        'netBoundingBoxMm': bbox,
        'pxPerMm': px_per_mm,
        'maxEdgePx': max_edge,
        'mainMask': main_mask,
        'printableMask': registration.get('printableMask'),
        'totalMask': registration.get('totalMask'),
    }


def rasterize_mask_png(registration, *, which: str = 'main') -> bytes:
    """Rasterize mask rings to black background / white printable (white_printable)."""
    validated = validate_registration_payload(registration)
    if which != 'main':
        raise AiJobError('unsupported mask which', code='VALIDATION_ERROR', status=400)
    rings = validated['mainMask']
    bbox = validated['netBoundingBoxMm']
    px_per_mm = validated['pxPerMm']
    max_edge = validated['maxEdgePx']
    scale = min(px_per_mm, max_edge / max(bbox['widthMm'], bbox['heightMm']))
    width_px = max(1, int(math.ceil(bbox['widthMm'] * scale)))
    height_px = max(1, int(math.ceil(bbox['heightMm'] * scale)))
    if width_px > MAX_EDGE_PX_CAP or height_px > MAX_EDGE_PX_CAP:
        raise AiJobError('mask raster too large', code='VALIDATION_ERROR', status=400)

    from PIL import Image, ImageDraw

    img = Image.new('L', (width_px, height_px), 0)
    draw = ImageDraw.Draw(img)
    min_x = bbox['minX']
    min_y = bbox['minY']
    for ring in rings:
        pts = []
        for i in range(0, len(ring), 2):
            x = (ring[i] - min_x) * scale
            y = (ring[i + 1] - min_y) * scale
            pts.append((x, y))
        if len(pts) >= 3:
            draw.polygon(pts, fill=255)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()
