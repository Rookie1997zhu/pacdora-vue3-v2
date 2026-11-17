from __future__ import annotations

import json
import logging
import uuid

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class RenderServiceError(Exception):
    def __init__(self, message, *, code='RENDER_SERVICE_ERROR', status_code=502):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def render_health() -> dict:
    url = f'{settings.RENDER_URL.rstrip("/")}/health'
    try:
        res = requests.get(url, timeout=5)
        res.raise_for_status()
        return res.json()
    except Exception as exc:  # noqa: BLE001
        raise RenderServiceError(str(exc), code='RENDER_UNAVAILABLE', status_code=503) from exc


def call_render(*, glb: bytes, params: dict, hdr: bytes | None = None, timeout: int | None = None) -> bytes:
    url = f'{settings.RENDER_URL.rstrip("/")}/render'
    boundary = f'----boxcraft{uuid.uuid4().hex}'
    parts = []
    # Do not send host-local hdr_path to the isolated render container.
    send_params = dict(params or {})
    send_params.pop('hdr_path', None)
    params_json = json.dumps(send_params).encode('utf-8')
    parts.append(
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="params"\r\n'
        f'Content-Type: application/json\r\n\r\n'.encode('utf-8')
        + params_json
        + b'\r\n'
    )
    parts.append(
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="scene.glb"\r\n'
        f'Content-Type: model/gltf-binary\r\n\r\n'.encode('utf-8')
        + glb
        + b'\r\n'
    )
    if hdr:
        parts.append(
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="hdr"; filename="env.hdr"\r\n'
            f'Content-Type: image/vnd.radiance\r\n\r\n'.encode('utf-8')
            + hdr
            + b'\r\n'
        )
    parts.append(f'--{boundary}--\r\n'.encode('utf-8'))
    body = b''.join(parts)
    headers = {'Content-Type': f'multipart/form-data; boundary={boundary}'}
    to = timeout if timeout is not None else int(getattr(settings, 'RENDER_TIMEOUT_SEC', 600))
    try:
        res = requests.post(url, data=body, headers=headers, timeout=to)
    except requests.RequestException as exc:
        raise RenderServiceError(str(exc), code='RENDER_UNAVAILABLE', status_code=503) from exc
    if res.status_code >= 400:
        detail = res.text[:500]
        logger.warning('render service error %s: %s', res.status_code, detail)
        raise RenderServiceError(detail or 'render failed', code='RENDER_FAILED', status_code=502)
    ctype = (res.headers.get('Content-Type') or '').lower()
    data = res.content
    is_png = data.startswith(b'\x89PNG') or 'image/png' in ctype
    is_jpg = data.startswith(b'\xff\xd8') or 'image/jpeg' in ctype or 'image/jpg' in ctype
    want_jpg = str((params or {}).get('format') or 'png').lower() in ('jpg', 'jpeg')
    if want_jpg:
        if not is_jpg and not is_png:
            raise RenderServiceError('render service returned non-image', code='RENDER_FAILED', status_code=502)
    elif not is_png:
        raise RenderServiceError('render service returned non-png', code='RENDER_FAILED', status_code=502)
    return data
