"""In-process size-lock save checks for all import-* products (no HTTP rate limit).
Usage (inside backend container or with DJANGO_SETTINGS_MODULE):
  python scripts/audit/batch-catalog-save-check.py
  # or: docker compose exec -T backend python /app/../scripts/... 
Writes/merges docs/产品目录_导出与保存批量测试_save.json
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# When copied into the container as /tmp/*.py, BACKEND is /app.
BACKEND = Path(os.environ.get('BACKEND_ROOT', '/app'))
ROOT = Path(os.environ.get('REPO_ROOT', str(BACKEND.parent if (BACKEND / 'manage.py').exists() else BACKEND)))
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.environ.get('DJANGO_SETTINGS_MODULE', 'config.settings.production'))

import django

django.setup()

from apps.accounts.models import User  # noqa: E402
from apps.catalog.models import Product  # noqa: E402
from apps.designs.services import DesignServiceError, create_design, save_revision  # noqa: E402
from apps.organizations.services import ensure_personal_org  # noqa: E402


def main():
    email = os.environ.get('SMOKE_EMAIL', 'smoke@boxcraft.local')
    user = User.objects.filter(email=email).first()
    if not user:
        user = User.objects.filter(is_staff=True).first()
    if not user:
        raise SystemExit('no smoke/staff user')
    org = ensure_personal_org(user)

    products = list(
        Product.objects.filter(status=Product.Status.PUBLISHED, slug__startswith='import-')
        .select_related('default_template', 'default_template_version')
        .order_by('category', 'slug')
    )
    out = {}
    for i, p in enumerate(products, 1):
        row = {'slug': p.slug, 'save_ok': 'N', 'save_reject_resize': 'N', 'problems': []}
        try:
            ver = p.default_template_version or p.default_template.versions.filter(is_current=True).first()
            caps = p.capabilities or {}
            defaults = dict(
                caps.get('default_params')
                or {
                    'lengthMm': 300,
                    'widthMm': 200,
                    'heightMm': 50,
                    'thicknessMm': 1.5,
                    'sizeMode': 'inner',
                    'fluteDirection': 'L',
                    'materialId': 'kraft',
                    'bleedInputMm': 3,
                    'advanced': {},
                }
            )
            initial = {
                'schemaVersion': 'boxcraft.design.v1',
                'locale': 'zh-CN',
                'geometry': {
                    'mode': p.default_template.geometry_mode,
                    'templateId': p.default_template.template_key,
                    'templateVersion': ver.version if ver else '1',
                    'engineVersion': ver.engine_version if ver else 'boxcraft.knife.v3',
                    'params': defaults,
                    'geometryHash': 'pending',
                },
                'artwork': {'backgroundColor': None, 'layers': []},
                'aiSettings': None,
                'outbox': {
                    'enabled': False,
                    'sizingMode': 'grow',
                    'quantity': 1,
                    'thicknessMm': 3,
                    'gapsMm': {'length': 5, 'width': 5, 'height': 5},
                },
            }
            design = create_design(
                organization=org,
                owner=user,
                name=f'audit-{p.slug}',
                product=p,
                initial_content=initial,
            )
            row['save_ok'] = 'Y'
            design.refresh_from_db()
            rev = design.current_revision
            content = dict(rev.content_json or {})
            geom = dict(content.get('geometry') or {})
            params = dict(geom.get('params') or {})
            params['lengthMm'] = float(params.get('lengthMm') or 0) + 25
            geom['params'] = params
            content['geometry'] = geom
            try:
                save_revision(
                    design=design,
                    user=user,
                    content=content,
                    expected_row_version=design.row_version,
                    idempotency_key=None,
                    autosave=True,
                )
                row['problems'].append('resized save allowed')
            except DesignServiceError as exc:
                if getattr(exc, 'code', '') == 'SIZE_LOCKED':
                    row['save_reject_resize'] = 'Y'
                else:
                    row['problems'].append(f'resize {exc.code}:{exc}')
            design.delete()
        except DesignServiceError as exc:
            row['problems'].append(f'create {exc.code}:{exc}')
        except Exception as exc:  # noqa: BLE001
            row['problems'].append(f'error:{exc}')
        out[p.slug] = row
        if i % 50 == 0 or i == len(products):
            print(f'{i}/{len(products)}')

    dest = Path(os.environ.get('SAVE_OUT', '/tmp/产品目录_导出与保存批量测试_save.json'))
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    ok = sum(1 for r in out.values() if r['save_ok'] == 'Y' and r['save_reject_resize'] == 'Y' and not r['problems'])
    print(f'done {len(out)} ok={ok} written {dest}')


if __name__ == '__main__':
    main()
