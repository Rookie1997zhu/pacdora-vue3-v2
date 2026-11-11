from __future__ import annotations

import requests
from django.conf import settings


class GeometryServiceError(Exception):
    def __init__(self, message, *, code='GEOMETRY_ERROR', status_code=502, payload=None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.payload = payload or {}


def _post(path: str, payload: dict) -> dict:
    url = f'{settings.GEOMETRY_URL}{path}'
    try:
        resp = requests.post(url, json=payload, timeout=20)
    except requests.RequestException as exc:
        raise GeometryServiceError(f'geometry unreachable: {exc}', code='GEOMETRY_UNAVAILABLE', status_code=503) from exc
    try:
        data = resp.json()
    except ValueError as exc:
        raise GeometryServiceError('geometry returned non-json', code='GEOMETRY_BAD_RESPONSE', status_code=502) from exc
    if resp.status_code >= 400:
        raise GeometryServiceError(
            data.get('message') or 'geometry rejected request',
            code=data.get('code') or 'GEOMETRY_REJECTED',
            status_code=400,
            payload=data,
        )
    return data.get('data', data)


def validate_geometry(payload: dict) -> dict:
    return _post('/validate', payload)


def solve_packing(payload: dict) -> dict:
    return _post('/packing/solve', payload)


def export_dieline(payload: dict) -> dict:
    # PDF generation can be slower than validate
    url = f'{settings.GEOMETRY_URL}/export'
    try:
        resp = requests.post(url, json=payload, timeout=60)
    except requests.RequestException as exc:
        raise GeometryServiceError(f'geometry unreachable: {exc}', code='GEOMETRY_UNAVAILABLE', status_code=503) from exc
    try:
        data = resp.json()
    except ValueError as exc:
        raise GeometryServiceError('geometry returned non-json', code='GEOMETRY_BAD_RESPONSE', status_code=502) from exc
    if resp.status_code >= 400:
        raise GeometryServiceError(
            data.get('message') or 'geometry rejected request',
            code=data.get('code') or 'GEOMETRY_REJECTED',
            status_code=400,
            payload=data,
        )
    return data.get('data', data)
