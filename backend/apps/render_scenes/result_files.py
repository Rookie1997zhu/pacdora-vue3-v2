"""Ephemeral render result files (shared volume, not Asset/media catalog)."""
from __future__ import annotations

import hashlib
from pathlib import Path

from django.conf import settings


def ephemeral_dir() -> Path:
    root = Path(getattr(settings, 'MEDIA_ROOT', '.') or '.')
    path = root / 'render_ephemeral'
    path.mkdir(parents=True, exist_ok=True)
    return path


def result_path(job_id, *, format: str) -> Path:
    fmt = (format or 'png').strip().lower()
    ext = 'jpg' if fmt in ('jpg', 'jpeg') else 'png'
    return ephemeral_dir() / f'{job_id}.{ext}'


def write_result(job_id, *, data: bytes, format: str) -> tuple[Path, str]:
    path = result_path(job_id, format=format)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    checksum = hashlib.sha256(data).hexdigest()
    return path, checksum


def resolve_result_path(job_id, *, format: str) -> Path | None:
    path = result_path(job_id, format=format)
    if path.is_file():
        return path
    # Fallback: opposite extension if format metadata drifted.
    alt = result_path(job_id, format='jpg' if path.suffix == '.png' else 'png')
    if alt.is_file():
        return alt
    return None


def delete_result(job_id, *, format: str | None = None) -> None:
    candidates = []
    if format:
        candidates.append(result_path(job_id, format=format))
    else:
        candidates.extend(
            [
                result_path(job_id, format='png'),
                result_path(job_id, format='jpg'),
            ]
        )
    for path in candidates:
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            pass


def mime_for_path(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in ('.jpg', '.jpeg'):
        return 'image/jpeg'
    return 'image/png'


def download_filename(job_id, path: Path) -> str:
    return f'render-{job_id}{path.suffix.lower()}'
