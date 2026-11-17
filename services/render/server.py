#!/usr/bin/env python3
"""Internal HTTP wrapper around Blender Cycles rendering.

No database credentials. Accepts GLB + scene JSON params, returns PNG bytes.
Set RENDER_MOCK=1 to return a synthetic PNG without invoking Blender (tests/dev).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', '3200'))
BLENDER_BIN = os.environ.get('BLENDER_BIN', 'blender')
SCRIPT_PATH = Path(__file__).resolve().parent / 'render_scene.py'
MAX_BODY = int(os.environ.get('RENDER_MAX_BODY_BYTES', str(100 * 1024 * 1024)))
RENDER_MOCK = os.environ.get('RENDER_MOCK', 'false').lower() in ('1', 'true', 'yes')
DEFAULT_SAMPLES = int(os.environ.get('RENDER_SAMPLES', '64'))
TIMEOUT_SEC = int(os.environ.get('RENDER_TIMEOUT_SEC', '600'))


def _png_1x1() -> bytes:
    return bytes.fromhex(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
        '0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082'
    )


def _make_mock_png(width: int, height: int) -> bytes:
    """Minimal valid PNG via Pillow if available; else 1x1 fallback."""
    try:
        from PIL import Image, ImageDraw

        img = Image.new('RGB', (max(1, width), max(1, height)), (245, 246, 248))
        draw = ImageDraw.Draw(img)
        margin = max(8, min(width, height) // 20)
        draw.rectangle(
            [margin, margin, width - margin, height - margin],
            outline=(40, 44, 52),
            width=max(2, margin // 4),
        )
        draw.text((margin * 2, margin * 2), 'BOXCRAFT MOCK RENDER', fill=(40, 44, 52))
        import io

        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()
    except Exception:  # noqa: BLE001
        return _png_1x1()


def _read_multipart(handler: BaseHTTPRequestHandler) -> dict:
    ctype = handler.headers.get('Content-Type', '')
    length = int(handler.headers.get('Content-Length') or 0)
    if length <= 0 or length > MAX_BODY:
        raise ValueError('body too large or empty')
    body = handler.rfile.read(length)
    if 'application/json' in ctype:
        data = json.loads(body.decode('utf-8'))
        return {
            'params': data.get('params') or data,
            'glb': None,
            'glb_b64': data.get('glb_base64'),
        }
    if 'multipart/form-data' not in ctype:
        raise ValueError('expected multipart/form-data or application/json')
    boundary = None
    for part in ctype.split(';'):
        part = part.strip()
        if part.startswith('boundary='):
            boundary = part.split('=', 1)[1].strip().strip('"')
    if not boundary:
        raise ValueError('multipart boundary missing')
    marker = b'--' + boundary.encode('ascii')
    chunks = body.split(marker)
    fields: dict = {'params': {}, 'glb': None}
    for chunk in chunks:
        if not chunk or chunk in (b'--', b'--\r\n', b'\r\n'):
            continue
        if chunk.startswith(b'--'):
            continue
        if chunk.startswith(b'\r\n'):
            chunk = chunk[2:]
        if chunk.endswith(b'\r\n'):
            chunk = chunk[:-2]
        header_blob, _, payload = chunk.partition(b'\r\n\r\n')
        headers = header_blob.decode('utf-8', errors='replace')
        if payload.endswith(b'\r\n'):
            payload = payload[:-2]
        name = None
        filename = None
        for line in headers.split('\r\n'):
            if line.lower().startswith('content-disposition:'):
                for token in line.split(';'):
                    token = token.strip()
                    if token.startswith('name='):
                        name = token.split('=', 1)[1].strip().strip('"')
                    if token.startswith('filename='):
                        filename = token.split('=', 1)[1].strip().strip('"')
        if not name:
            continue
        if name in ('hdr', 'hdr_file') or (filename and str(filename).lower().endswith('.hdr')):
            fields['hdr'] = payload
        elif name in ('file', 'glb') or filename:
            fields['glb'] = payload
        elif name == 'params':
            fields['params'] = json.loads(payload.decode('utf-8'))
        else:
            try:
                fields['params'][name] = json.loads(payload.decode('utf-8'))
            except Exception:  # noqa: BLE001
                fields['params'][name] = payload.decode('utf-8', errors='replace')
    return fields


def run_blender_render(*, glb_path: Path, params: dict, out_path: Path) -> None:
    params_path = out_path.with_suffix('.params.json')
    params_path.write_text(json.dumps(params), encoding='utf-8')
    cmd = [
        BLENDER_BIN,
        '--background',
        '--python',
        str(SCRIPT_PATH),
        '--',
        '--glb',
        str(glb_path),
        '--params',
        str(params_path),
        '--out',
        str(out_path),
    ]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=TIMEOUT_SEC,
        check=False,
    )
    if proc.returncode != 0 or not out_path.is_file():
        raise RuntimeError(
            f'blender failed code={proc.returncode}\nstdout={proc.stdout[-2000:]}\nstderr={proc.stderr[-2000:]}'
        )


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        print(f'[render] {self.address_string()} - {fmt % args}')

    def _send(self, status: int, body: bytes, content_type: str):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, status: int, payload: dict):
        raw = json.dumps(payload).encode('utf-8')
        self._send(status, raw, 'application/json; charset=utf-8')

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ('/health', '/health/'):
            self._send_json(
                200,
                {
                    'ok': True,
                    'mock': RENDER_MOCK,
                    'blender': shutil.which(BLENDER_BIN) is not None,
                },
            )
            return
        self._send_json(404, {'ok': False, 'error': 'not_found'})

    def do_POST(self):
        path = urlparse(self.path).path
        if path not in ('/render', '/render/'):
            self._send_json(404, {'ok': False, 'error': 'not_found'})
            return
        try:
            fields = _read_multipart(self)
            params = fields.get('params') or {}
            if not isinstance(params, dict):
                params = {}
            width = int(params.get('width') or 2048)
            height = int(params.get('height') or 2048)
            samples = int(params.get('samples') or DEFAULT_SAMPLES)
            params['width'] = width
            params['height'] = height
            params['samples'] = samples

            glb = fields.get('glb')
            if not glb and fields.get('glb_b64'):
                import base64

                glb = base64.b64decode(fields['glb_b64'])
            if not glb:
                self._send_json(400, {'ok': False, 'error': 'glb_required'})
                return

            fmt = str(params.get('format') or 'png').lower()
            if RENDER_MOCK:
                png = _make_mock_png(width, height)
                ctype = 'image/jpeg' if fmt in ('jpg', 'jpeg') else 'image/png'
                self._send(200, png, ctype)
                return

            with tempfile.TemporaryDirectory(prefix='boxcraft-render-') as tmp:
                tmp_path = Path(tmp)
                glb_path = tmp_path / 'scene.glb'
                out_name = 'out.jpg' if fmt in ('jpg', 'jpeg') else 'out.png'
                out_path = tmp_path / out_name
                glb_path.write_bytes(glb)
                hdr = fields.get('hdr')
                if hdr:
                    hdr_path = tmp_path / 'env.hdr'
                    hdr_path.write_bytes(hdr)
                    params['hdr_path'] = str(hdr_path)
                run_blender_render(glb_path=glb_path, params=params, out_path=out_path)
                # Blender may rewrite extension
                if not out_path.is_file():
                    alt = out_path.with_suffix('.jpg' if fmt in ('jpg', 'jpeg') else '.png')
                    if alt.is_file():
                        out_path = alt
                image = out_path.read_bytes()
            ctype = 'image/jpeg' if fmt in ('jpg', 'jpeg') else 'image/png'
            self._send(200, image, ctype)
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            self._send_json(500, {'ok': False, 'error': str(exc)[:1000]})


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'[render] listening on {HOST}:{PORT} mock={RENDER_MOCK}')
    server.serve_forever()


if __name__ == '__main__':
    main()
