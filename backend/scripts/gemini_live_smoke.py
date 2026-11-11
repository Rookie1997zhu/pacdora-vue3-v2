"""One-off Gemini live smoke. Reads key from env or local file; never prints the key."""
from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path

# Ensure backend root is on path when run as script
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

KEY_CANDIDATES = [
    Path(os.environ.get('AI_API_KEY_FILE', '')),
    BACKEND_ROOT.parent.parent / 'api key.md',
    BACKEND_ROOT.parent / 'api key.md',
]


def _load_key() -> str:
    env_key = (os.environ.get('AI_API_KEY') or '').strip()
    if env_key:
        return env_key
    for path in KEY_CANDIDATES:
        if path and path.is_file():
            text = path.read_text(encoding='utf-8').strip()
            if text:
                return text
    raise SystemExit('AI_API_KEY missing (set env or provide api key.md)')


def _registration(geometry_hash: str) -> dict:
    return {
        'geometryHash': geometry_hash,
        'maskHash': f'smoke-{uuid.uuid4().hex[:8]}',
        'polarity': 'white_printable',
        'printableMask': [[0, 0, 100, 0, 100, 80, 0, 80, 0, 0]],
        'totalMask': [[0, 0, 100, 0, 100, 80, 0, 80, 0, 0]],
        'mainMask': [[10, 10, 90, 10, 90, 70, 10, 70, 10, 10]],
        'netBoundingBoxMm': {'minX': 0, 'minY': 0, 'widthMm': 100, 'heightMm': 80},
        'pxPerMm': 4,
        'maxEdgePx': 1024,
    }


def main() -> int:
    key = _load_key()
    os.environ['AI_API_KEY'] = key
    os.environ.setdefault('AI_PROVIDER', 'gemini')
    os.environ.setdefault('AI_MODEL', 'gemini-2.5-flash-image')
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

    import django

    django.setup()

    from django.core.management import call_command
    from django.test import Client

    from apps.accounts.models import User
    from apps.ai_jobs.capabilities import list_capabilities
    from apps.ai_jobs.models import AiJob, UsageLedger, UsageReservation
    from apps.assets.models import Asset
    from apps.organizations.services import ensure_personal_org

    call_command('seed_catalog')

    email = f'gemini-smoke-{uuid.uuid4().hex[:8]}@example.com'
    user = User.objects.create_user(email=email, password='Password123!')
    ensure_personal_org(user)

    caps = list_capabilities()
    ops = {o['operation']: o for o in caps['operations']}
    ig = ops.get('image_generate') or {}
    ma = ops.get('main_area_generate') or {}
    print('capabilities.provider=', caps.get('provider'))
    print('image_generate.enabled=', ig.get('enabled'), 'reason=', ig.get('reason') or '')
    print(
        'main_area_generate.enabled=',
        ma.get('enabled'),
        'mask_input=',
        ma.get('mask_input'),
        'reason=',
        ma.get('reason') or '',
    )
    if not ig.get('enabled'):
        print('SMOKE_FAIL capabilities disabled')
        return 1
    if not ma.get('enabled') or not ma.get('mask_input'):
        print('SMOKE_FAIL main_area mask_input not enabled')
        return 1

    client = Client(enforce_csrf_checks=True)
    client.force_login(user)
    csrf = client.get('/api/v1/auth/csrf/').json()['data']['csrf_token']
    create = client.post(
        '/api/v1/designs/',
        data=json.dumps({'name': 'Gemini Smoke', 'product_slug': 'import-102040'}),
        content_type='application/json',
        HTTP_X_CSRFTOKEN=csrf,
    )
    if create.status_code != 201:
        print('SMOKE_FAIL design_create', create.status_code, create.content[:300])
        return 1
    design_id = create.json()['data']['id']
    idem = f'gemini-smoke-{uuid.uuid4()}'
    csrf = client.get('/api/v1/auth/csrf/').json()['data']['csrf_token']
    payload = json.dumps(
        {
            'operation': 'image_generate',
            'prompt': 'Simple kraft mailer box packaging artwork, flat graphic, no text',
        }
    )
    r1 = client.post(
        f'/api/v1/designs/{design_id}/ai-jobs/',
        data=payload,
        content_type='application/json',
        HTTP_X_CSRFTOKEN=csrf,
        HTTP_IDEMPOTENCY_KEY=idem,
    )
    body1 = r1.json()
    print('job1.status_code=', r1.status_code)
    if r1.status_code not in (200, 202):
        print('SMOKE_FAIL job_create', body1.get('code'), body1.get('message'))
        return 1
    job1 = body1['data']
    print('job1.id=', job1['id'])
    print('job1.status=', job1['status'])
    print('job1.provider=', job1.get('provider'))
    print('job1.result_asset_id=', job1.get('result_asset_id'))
    if job1.get('error_code'):
        print('job1.error_code=', job1.get('error_code'))
        print('job1.error_message=', (job1.get('error_message') or '')[:200])
    if job1['status'] != 'succeeded' or not job1.get('result_asset_id'):
        print('SMOKE_FAIL not succeeded')
        return 1

    csrf = client.get('/api/v1/auth/csrf/').json()['data']['csrf_token']
    r2 = client.post(
        f'/api/v1/designs/{design_id}/ai-jobs/',
        data=payload,
        content_type='application/json',
        HTTP_X_CSRFTOKEN=csrf,
        HTTP_IDEMPOTENCY_KEY=idem,
    )
    job2 = r2.json()['data']
    print('job2.status_code=', r2.status_code)
    print('job2.id=', job2['id'])
    print('idempotent_same=', job2['id'] == job1['id'])
    print('asset_count=', Asset.objects.filter(id=job1['result_asset_id']).count())
    print('job_count=', AiJob.objects.filter(idempotency_key=idem).count())
    print(
        'reservation_settled=',
        UsageReservation.objects.filter(job_id=job1['id'], status='settled').count(),
    )
    print('ledger_count=', UsageLedger.objects.filter(job_id=job1['id']).count())

    if r2.status_code != 200 or job2['id'] != job1['id']:
        print('SMOKE_FAIL idempotency')
        return 1

    # --- P4.3 main_area + mask ---
    csrf = client.get('/api/v1/auth/csrf/').json()['data']['csrf_token']
    create_ma = client.post(
        '/api/v1/designs/',
        data=json.dumps({'name': 'Gemini MainArea Smoke', 'product_slug': 'mailer-parametric-demo'}),
        content_type='application/json',
        HTTP_X_CSRFTOKEN=csrf,
    )
    if create_ma.status_code != 201:
        print('SMOKE_FAIL main_area design_create', create_ma.status_code, create_ma.content[:300])
        return 1
    ma_design = create_ma.json()['data']
    ma_design_id = ma_design['id']
    geom_hash = (ma_design.get('content') or {}).get('geometry', {}).get('geometryHash') or ''
    if not geom_hash:
        print('SMOKE_FAIL missing geometryHash')
        return 1
    registration = _registration(geom_hash)
    csrf = client.get('/api/v1/auth/csrf/').json()['data']['csrf_token']
    ma_idem = f'gemini-main-area-{uuid.uuid4()}'
    ma_payload = json.dumps(
        {
            'operation': 'main_area_generate',
            'prompt': 'Flat kraft packaging dieline artwork, geometric pattern, no text',
            'registration': registration,
        }
    )
    r_ma = client.post(
        f'/api/v1/designs/{ma_design_id}/ai-jobs/',
        data=ma_payload,
        content_type='application/json',
        HTTP_X_CSRFTOKEN=csrf,
        HTTP_IDEMPOTENCY_KEY=ma_idem,
    )
    body_ma = r_ma.json()
    print('main_area.status_code=', r_ma.status_code)
    if r_ma.status_code not in (200, 202):
        print('SMOKE_FAIL main_area job_create', body_ma.get('code'), body_ma.get('message'))
        return 1
    job_ma = body_ma['data']
    print('main_area.id=', job_ma['id'])
    print('main_area.status=', job_ma['status'])
    print('main_area.result_asset_id=', job_ma.get('result_asset_id'))
    if job_ma.get('error_code'):
        print('main_area.error_code=', job_ma.get('error_code'))
        print('main_area.error_message=', (job_ma.get('error_message') or '')[:200])
    if job_ma['status'] != 'succeeded' or not job_ma.get('result_asset_id'):
        print('SMOKE_FAIL main_area not succeeded')
        return 1
    job_row = AiJob.objects.get(pk=job_ma['id'])
    meta_hash = (job_row.meta or {}).get('maskHash')
    print('main_area.meta.maskHash=', meta_hash)
    if not meta_hash:
        print('SMOKE_FAIL main_area missing meta.maskHash')
        return 1
    print('SMOKE_PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
