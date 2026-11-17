"""Sync MaterialProfile rows from geometry-engine materialProfiles (JSON preferred)."""

from __future__ import annotations

import json
import subprocess
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.catalog.models import MaterialProfile

COMMAND_DIR = Path(__file__).resolve().parent
# backend/apps/catalog/management/commands → backend/
BACKEND_ROOT = COMMAND_DIR.parents[3]
REPO_CANDIDATES = [
    BACKEND_ROOT.parent,  # local: .../pacdora-vue3-v2
    Path('/'),  # compose image: packages under /packages
    BACKEND_ROOT,
]
JSON_CANDIDATES = [
    BACKEND_ROOT / 'apps' / 'catalog' / 'data' / 'material_profiles.json',
    Path('/packages/geometry-engine/material_profiles.json'),
]


def _profiles_js_path() -> Path | None:
    for root in REPO_CANDIDATES:
        path = root / 'packages' / 'geometry-engine' / 'materialProfiles.js'
        if path.is_file():
            return path
        path = Path('/packages/geometry-engine/materialProfiles.js')
        if path.is_file():
            return path
    return None


def load_engine_profiles() -> list[dict]:
    for json_path in JSON_CANDIDATES:
        if json_path.is_file():
            try:
                return json.loads(json_path.read_text(encoding='utf-8-sig'))
            except json.JSONDecodeError as exc:
                raise CommandError(f'Invalid JSON {json_path}: {exc}') from exc

    profiles_js = _profiles_js_path()
    if not profiles_js:
        raise CommandError(
            'Missing material_profiles.json and materialProfiles.js '
            '(run node export locally or rebuild backend image with /packages/geometry-engine)'
        )

    repo_root = profiles_js.parents[2] if profiles_js.as_posix().startswith('/packages/') else profiles_js.parents[2]
    # /packages/geometry-engine/file → parents[1]=/packages, parents[2]=/
    if profiles_js.parent.name == 'geometry-engine' and profiles_js.parent.parent.name == 'packages':
        repo_root = profiles_js.parent.parent.parent
        import_path = './packages/geometry-engine/materialProfiles.js'
        cwd = str(repo_root) if repo_root != Path('/') else '/'
        if repo_root == Path('/'):
            import_path = '/packages/geometry-engine/materialProfiles.js'
            cwd = '/'
    else:
        repo_root = profiles_js.parents[2]
        import_path = './packages/geometry-engine/materialProfiles.js'
        cwd = str(repo_root)

    script = f"""
import {{ listMaterialProfiles }} from '{import_path}';
const rows = listMaterialProfiles({{ includeLegacy: true }});
process.stdout.write(JSON.stringify(rows));
"""
    proc = subprocess.run(
        ['node', '--input-type=module', '-e', script],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise CommandError(f'Failed to load materialProfiles.js: {proc.stderr or proc.stdout}')
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise CommandError(f'Invalid JSON from materialProfiles.js: {exc}') from exc


class Command(BaseCommand):
    help = 'Sync MaterialProfile table from geometry-engine materialProfiles.js / JSON'

    @transaction.atomic
    def handle(self, *args, **options):
        rows = load_engine_profiles()
        seen = set()
        for row in rows:
            code = str(row.get('id') or '').strip()
            if not code:
                continue
            seen.add(code)
            thickness = row.get('thickness') or {}
            MaterialProfile.objects.update_or_create(
                code=code,
                defaults={
                    'name_zh': str(row.get('labelZh') or code),
                    'name_ko': str(row.get('labelKo') or ''),
                    'family': str(row.get('family') or 'kraft'),
                    'flute': str(row.get('flute') or ''),
                    'thickness_min': Decimal(str(thickness.get('min') or 0)),
                    'thickness_default': Decimal(str(thickness.get('default') or 0)),
                    'thickness_max': Decimal(str(thickness.get('max') or 0)),
                    'engine_material_id': str(row.get('engineMaterialId') or 'kraft'),
                    'calibrated': bool(row.get('calibrated')),
                    'profile_version': str(row.get('profileVersion') or '0.1'),
                    'is_active': True,
                },
            )
        MaterialProfile.objects.exclude(code__in=seen).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f'sync_material_profiles done ({len(seen)} active)'))
