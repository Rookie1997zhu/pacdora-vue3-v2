from __future__ import annotations

import json
import struct

from django.conf import settings

from apps.render_scenes.errors import RenderSceneError

GLB_MAGIC = b'glTF'
GLB_VERSION = 2
MAX_MESHES = 500
MAX_IMAGES = 64


def validate_glb(data: bytes) -> dict:
    max_bytes = int(getattr(settings, 'RENDER_MAX_GLB_BYTES', 80 * 1024 * 1024))
    if not data:
        raise RenderSceneError('empty glb', code='VALIDATION_ERROR', status=400)
    if len(data) > max_bytes:
        raise RenderSceneError('glb too large', code='FILE_TOO_LARGE', status=400)
    if len(data) < 12:
        raise RenderSceneError('glb header too short', code='INVALID_GLB', status=400)
    magic, version, length = struct.unpack_from('<4sII', data, 0)
    if magic != GLB_MAGIC:
        raise RenderSceneError('not a glb file', code='INVALID_GLB', status=400)
    if version != GLB_VERSION:
        raise RenderSceneError('unsupported glb version', code='INVALID_GLB', status=400)
    if length != len(data):
        raise RenderSceneError('glb length mismatch', code='INVALID_GLB', status=400)

    offset = 12
    json_chunk = None
    while offset + 8 <= len(data):
        chunk_len, chunk_type = struct.unpack_from('<I4s', data, offset)
        offset += 8
        if offset + chunk_len > len(data):
            raise RenderSceneError('glb chunk truncated', code='INVALID_GLB', status=400)
        chunk = data[offset : offset + chunk_len]
        offset += chunk_len
        if chunk_type == b'JSON':
            try:
                text = chunk.decode('utf-8').rstrip(' \x00')
                json_chunk = json.loads(text)
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise RenderSceneError('glb json invalid', code='INVALID_GLB', status=400) from exc
        elif chunk_type not in (b'BIN\x00',):
            raise RenderSceneError('unexpected glb chunk', code='INVALID_GLB', status=400)

    if not isinstance(json_chunk, dict):
        raise RenderSceneError('glb missing json chunk', code='INVALID_GLB', status=400)

    # Reject external URIs (buffer/image/etc.)
    for key in ('buffers', 'images', 'buffersViews'):
        pass
    for collection_name in ('buffers', 'images'):
        for item in json_chunk.get(collection_name) or []:
            if not isinstance(item, dict):
                continue
            uri = item.get('uri')
            if isinstance(uri, str) and uri.strip():
                # data: URIs are embedded; anything else is external
                if not uri.startswith('data:'):
                    raise RenderSceneError(
                        'external uri not allowed in glb',
                        code='INVALID_GLB',
                        status=400,
                        errors={'uri': [uri[:120]]},
                    )

    meshes = json_chunk.get('meshes') or []
    images = json_chunk.get('images') or []
    if len(meshes) > MAX_MESHES:
        raise RenderSceneError('too many meshes', code='INVALID_GLB', status=400)
    if len(images) > MAX_IMAGES:
        raise RenderSceneError('too many images', code='INVALID_GLB', status=400)

    return {
        'mesh_count': len(meshes),
        'image_count': len(images),
        'byte_size': len(data),
    }
