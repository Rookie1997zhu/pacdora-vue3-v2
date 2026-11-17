#!/usr/bin/env python3
"""Benchmark render service latency for 2K/4K.

Usage:
  RENDER_MOCK=true python services/render/benchmark.py
  RENDER_URL=http://127.0.0.1:3200 python services/render/benchmark.py

Writes a short JSON report to services/render/benchmark_result.json.
Without Blender, MOCK mode only measures HTTP overhead — set RENDER_MOCK=false
against a real render container for Cycles timing.
"""
from __future__ import annotations

import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
URL = os.environ.get('RENDER_URL', 'http://127.0.0.1:3200').rstrip('/')


def minimal_glb() -> bytes:
    gltf = {
        'asset': {'version': '2.0'},
        'scenes': [{'nodes': [0]}],
        'scene': 0,
        'nodes': [{'mesh': 0}],
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


def post_render(width: int, height: int, samples: int, glb: bytes) -> dict:
    boundary = '----boxcraftbench'
    params = json.dumps(
        {
            'width': width,
            'height': height,
            'samples': samples,
            'camera': {'position': {'x': 420, 'y': 320, 'z': 420}, 'target': {'x': 0, 'y': 40, 'z': 0}, 'fov': 38},
            'light': {'preset': 'softbox', 'sunPhi': 45, 'sunTheta': 35, 'sunIntensity': 1.6, 'envIntensity': 0.85},
            'background': {'type': 'solid', 'color': '#F5F6F8', 'gradient': {'top': '#EEF1F5', 'bottom': '#D8DEE8'}},
            'ground': {'visible': True, 'shadowIntensity': 0.45},
            'unit_scale': 0.001,
        }
    ).encode('utf-8')
    body = b''.join(
        [
            f'--{boundary}\r\nContent-Disposition: form-data; name="params"\r\nContent-Type: application/json\r\n\r\n'.encode()
            + params
            + b'\r\n',
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="scene.glb"\r\nContent-Type: model/gltf-binary\r\n\r\n'.encode()
            + glb
            + b'\r\n',
            f'--{boundary}--\r\n'.encode(),
        ]
    )
    req = urllib.request.Request(
        f'{URL}/render',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST',
    )
    started = time.perf_counter()
    with urllib.request.urlopen(req, timeout=int(os.environ.get('RENDER_TIMEOUT_SEC', '600'))) as res:
        data = res.read()
        ctype = res.headers.get('Content-Type', '')
    elapsed = time.perf_counter() - started
    return {
        'width': width,
        'height': height,
        'samples': samples,
        'seconds': round(elapsed, 3),
        'bytes': len(data),
        'content_type': ctype,
        'ok_png': data[:8] == b'\x89PNG\r\n\x1a\n',
    }


def main():
    try:
        with urllib.request.urlopen(f'{URL}/health', timeout=5) as res:
            health = json.loads(res.read().decode('utf-8'))
    except Exception as exc:  # noqa: BLE001
        print(f'health check failed: {exc}', file=sys.stderr)
        print('Start render service first, e.g. RENDER_MOCK=true python services/render/server.py')
        sys.exit(2)

    glb = minimal_glb()
    cases = [
        (2048, 2048, int(os.environ.get('RENDER_SAMPLES_2K', '64'))),
        (4096, 4096, int(os.environ.get('RENDER_SAMPLES_4K', '48'))),
    ]
    results = []
    for w, h, samples in cases:
        print(f'rendering {w}x{h} samples={samples} ...')
        try:
            results.append(post_render(w, h, samples, glb))
        except Exception as exc:  # noqa: BLE001
            results.append({'width': w, 'height': h, 'samples': samples, 'error': str(exc)})

    report = {
        'render_url': URL,
        'health': health,
        'results': results,
        'recommendation': {
            'samples_2k': int(os.environ.get('RENDER_SAMPLES_2K', '64')),
            'samples_4k': int(os.environ.get('RENDER_SAMPLES_4K', '48')),
            'allow_4k': True,
            'notes': (
                'MOCK timings are not Cycles timings. On CPU-only hosts, expect 2K in 1–several minutes '
                'and 4K roughly 4× longer; set RENDER_ALLOW_4K=false if 4K exceeds timeout/memory.'
            ),
        },
    }
    out = ROOT / 'benchmark_result.json'
    out.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
