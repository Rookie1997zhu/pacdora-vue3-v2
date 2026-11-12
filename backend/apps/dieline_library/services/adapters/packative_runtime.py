from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any

from django.utils import timezone

from apps.dieline_library.models import AcquisitionItem, AcquisitionJob
from apps.dieline_library.scrapy_packative.runner import (
    CrawlReport,
    assert_url_allowed,
    build_targets,
    run_cdn_crawl,
)
from apps.dieline_library.services.adapters.base import AdapterError, DryRunReport, JobResult
from apps.dieline_library.services.adapters.policy import budget_from_policy, load_policy_dict
from apps.dieline_library.services.import_manifest import ImportManifestError, import_local_manifest


def default_contract_path() -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / 'fixtures'
        / 'source_contracts'
        / 'packative_cdn_crashlock.json'
    )


def load_contract(policy: dict[str, Any] | None = None) -> dict[str, Any]:
    policy = policy or {}
    explicit = policy.get('contract_path')
    if explicit:
        path = Path(str(explicit))
    else:
        contract_id = str(policy.get('contract_id') or 'packative_cdn_crashlock')
        path = Path(__file__).resolve().parents[2] / 'fixtures' / 'source_contracts' / f'{contract_id}.json'
        if not path.is_file():
            path = default_contract_path()
    if not path.is_file():
        raise AdapterError(f'contract missing: {path}', code='CONTRACT_MISSING')
    raw = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(raw, dict):
        raise AdapterError('contract must be object', code='CONTRACT_INVALID')
    return raw


def planned_targets(policy: dict[str, Any], plan_specs: list | None = None) -> list[dict[str, Any]]:
    contract = load_contract(policy)
    dim = None
    if isinstance(plan_specs, list) and plan_specs:
        # Accept either {L,W,H} or {l,w,h}
        normalized = []
        for row in plan_specs:
            if not isinstance(row, dict):
                continue
            if 'L' in row or 'l' in row:
                normalized.append(
                    {
                        'L': int(row.get('L', row.get('l'))),
                        'W': int(row.get('W', row.get('w'))),
                        'H': int(row.get('H', row.get('h'))),
                        'reason': row.get('reason') or '',
                    }
                )
        if normalized:
            dim = normalized
    if dim is None:
        dim = policy.get('dimension_plan') if isinstance(policy.get('dimension_plan'), list) else None
    targets = build_targets(contract, dim)
    execution = policy.get('execution') or {}
    max_jobs = int(execution.get('max_jobs') or 0)
    if max_jobs > 0:
        targets = targets[:max_jobs]
    return targets


def planned_cdn_urls(policy: dict[str, Any], plan_specs: list | None = None) -> list[str]:
    return [t['url'] for t in planned_targets(policy, plan_specs)]


def dry_run_packative(plan, *, adapter_type: str) -> DryRunReport:
    from apps.dieline_library.services.adapters.policy import policy_block_codes

    policy = load_policy_dict(plan.policy_json)
    blocks = policy_block_codes(policy, plan_enabled=bool(plan.enabled))
    specs = plan.spec_plan_json if isinstance(plan.spec_plan_json, list) else []
    try:
        targets = planned_targets(policy, specs) if not blocks else []
    except AdapterError as exc:
        return DryRunReport(
            adapter_type=adapter_type,
            planned_count=0,
            budget_estimate=budget_from_policy(policy, 0),
            blocked=True,
            block_codes=[exc.code],
            notes=[str(exc)],
        )
    # SSRF pre-check on planned URLs (no network)
    allowed = policy.get('allowed_origins') or []
    for t in targets:
        try:
            assert_url_allowed(t['url'], allowed)
        except ValueError as exc:
            return DryRunReport(
                adapter_type=adapter_type,
                planned_count=0,
                budget_estimate=budget_from_policy(policy, 0),
                blocked=True,
                block_codes=[str(exc)],
                notes=[f'url blocked: {t["url"]}'],
            )
    items = [
        {
            'key': t['key'],
            'L': t['L'],
            'W': t['W'],
            'H': t['H'],
            'url': t['url'],
            'reason': t.get('reason') or '',
        }
        for t in targets
    ]
    return DryRunReport(
        adapter_type=adapter_type,
        planned_count=len(targets),
        budget_estimate=budget_from_policy(policy, len(targets)),
        blocked=bool(blocks),
        block_codes=blocks,
        items=items[:50],
        notes=(
            ['Online adapter blocked by explicit policy']
            if blocks
            else ['CDN dry_run: planned URLs only, no network']
        ),
    )


def _live_allowed(policy: dict[str, Any], job: AcquisitionJob) -> bool:
    execution = policy.get('execution') or {}
    require_live = bool(execution.get('require_live_flag', True))
    if not require_live:
        return True
    if bool(execution.get('live')):
        return True
    if bool((job.cursor_json or {}).get('live')):
        return True
    # Test/mock path: direct backend does not need --live when explicitly opted in.
    if bool(execution.get('allow_mock_without_live')):
        return True
    return False


def _rights_from_policy(policy: dict[str, Any]) -> dict[str, Any]:
    grant = policy.get('grant') or {}
    perms = policy.get('permissions') or {}
    return {
        'grant_status': 'granted' if (grant.get('perpetual') or (policy.get('access_review') or {}).get('status') == 'approved') else 'pending',
        'attribution': str(grant.get('attribution') or '')[:255],
        'permissions': {
            'can_store': bool(perms.get('can_store', True)),
            'can_transform': bool(perms.get('can_transform', True)),
            'can_use_internally': bool(perms.get('can_use_internally', True)),
            'can_use_commercially': bool(perms.get('can_use_commercially', False)),
            'can_show_public_preview': bool(perms.get('can_show_public_preview', False)),
            'can_redistribute_files': bool(perms.get('can_redistribute_files', False)),
        },
    }


def _build_manifest(
    *,
    contract: dict[str, Any],
    policy: dict[str, Any],
    fetched_ok: list[dict[str, Any]],
    files_root: Path,
) -> Path:
    rights = _rights_from_policy(policy)
    assets = []
    for row in fetched_ok:
        src = Path(row['path'])
        rel = src.name
        dest = files_root / rel
        if src.resolve() != dest.resolve():
            dest.write_bytes(src.read_bytes())
        L, W, H = int(row['L']), int(row['W']), int(row['H'])
        product = contract.get('product') or 'product'
        assets.append(
            {
                'is_example': False,
                'title': {'zh': f"{contract.get('family_name') or product} {L}×{W}×{H}", 'ko': ''},
                'family_name': contract.get('family_name') or product,
                'category': contract.get('category') or 'shipping',
                'source_template_id': product,
                'template_revision': 'cdn-1',
                'dimensions': {
                    'length_mm': L,
                    'width_mm': W,
                    'height_mm': H,
                    'basis': 'unknown',
                },
                'files': [{'path': rel, 'mime': 'image/svg+xml'}],
                'rights': rights,
                'quality': {
                    'publication_status': 'published',
                    'manufacturing_status': 'reference_only',
                },
                'source': {
                    'source_id': policy.get('source_id') or 'packative',
                    'source_record_id': row.get('key'),
                    'captured_at': timezone.now().isoformat(),
                    'url': row.get('url'),
                },
            }
        )
    manifest = {
        'schema_version': '1.0',
        'is_example': False,
        'provider': policy.get('source_id') or 'packative',
        'source': {'source_id': policy.get('source_id') or 'packative', 'source_type': 'authorized_api'},
        'assets': assets,
    }
    path = files_root / 'manifest.json'
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return path


def _normalize_failure_code(code: str | None) -> str:
    raw = (code or 'FETCH_FAILED').strip()
    mapping = {
        'http_401': 'http_401',
        'http_429': 'http_429',
        'http_403': 'http_403',
        'ACCESS_DENIED': 'access_denied',
        'access_denied_xml': 'access_denied',
        'SSRF_HOST_BLOCKED': 'SSRF_HOST_BLOCKED',
        'SSRF_SCHEME_BLOCKED': 'SSRF_SCHEME_BLOCKED',
        'SSRF_PRIVATE_HOST': 'SSRF_PRIVATE_HOST',
    }
    return mapping.get(raw, raw)[:64]


def run_job(job: AcquisitionJob) -> JobResult:
    plan = job.plan
    policy = load_policy_dict(plan.policy_json)
    execution = dict(policy.get('execution') or {})

    if not _live_allowed(policy, job):
        return JobResult(
            status=AcquisitionJob.Status.FAILED,
            error='Live network collect requires --live (execution.live=true)',
            error_code='LIVE_FLAG_REQUIRED',
            stats={'planned': 0, 'succeeded': 0, 'failed': 0, 'skipped': 0, 'bytes': 0},
        )

    owner_id = job.created_by_id
    if not owner_id:
        return JobResult(
            status=AcquisitionJob.Status.FAILED,
            error='job missing created_by_id',
            error_code='OWNER_REQUIRED',
        )
    from apps.accounts.models import User

    owner = User.objects.filter(id=owner_id).first()
    if not owner:
        return JobResult(
            status=AcquisitionJob.Status.FAILED,
            error='owner not found',
            error_code='OWNER_MISSING',
        )

    contract = load_contract(policy)
    specs = plan.spec_plan_json if isinstance(plan.spec_plan_json, list) else []
    targets = planned_targets(policy, specs)
    cursor = dict(job.cursor_json or {})
    start_index = int(cursor.get('next_index') or 0)
    remaining = targets[start_index:]

    stop_on = {str(x).lower() for x in (policy.get('stop_on') or [])}
    pause_on = {str(x).lower() for x in (policy.get('pause_on') or [])}

    stats = {
        'planned': len(targets),
        'succeeded': 0,
        'failed': 0,
        'skipped': 0,
        'paused': 0,
        'bytes': 0,
        'requests': 0,
    }

    if not remaining:
        return JobResult(status=AcquisitionJob.Status.SUCCEEDED, stats=stats, cursor=cursor)

    allowed = policy.get('allowed_origins') or []
    for t in remaining:
        try:
            assert_url_allowed(t['url'], allowed)
        except ValueError as exc:
            code = str(exc)
            AcquisitionItem.objects.update_or_create(
                job=job,
                external_key=t['key'][:255],
                defaults={
                    'spec_json': t,
                    'status': AcquisitionItem.Status.FAILED,
                    'failure_code': code[:64],
                    'failure_reason': f'url blocked: {t["url"]}',
                    'attempt_count': 1,
                },
            )
            stats['failed'] += 1
            return JobResult(
                status=AcquisitionJob.Status.FAILED,
                error=f'SSRF blocked: {t["url"]}',
                error_code=code,
                stats=stats,
                cursor=cursor,
            )

    max_bytes = int(execution.get('max_total_bytes') or 0)
    max_requests = int(execution.get('max_total_requests') or 0)
    delay = float(execution.get('min_seconds_between_jobs') or contract.get('min_interval_ms', 5000) / 1000)

    with tempfile.TemporaryDirectory(prefix='packative_cdn_') as tmp:
        tmp_path = Path(tmp)
        files_root = tmp_path / 'files'
        files_root.mkdir(parents=True, exist_ok=True)
        results_path = tmp_path / 'results.json'
        job_ctx: dict[str, Any] = {
            'output_dir': str(files_root),
            'results_path': str(results_path),
            'targets': remaining,
            'allowed_origins': allowed,
            'download_delay': delay,
            'timeout_seconds': int(execution.get('job_timeout_seconds') or 600),
        }
        if execution.get('crawl_backend'):
            job_ctx['backend'] = execution['crawl_backend']

        report: CrawlReport = run_cdn_crawl(job_ctx)
        if report.error and not report.items:
            return JobResult(
                status=AcquisitionJob.Status.FAILED,
                error=report.error[:500],
                error_code='CRAWL_FAILED',
                stats=stats,
                cursor=cursor,
            )

        stats['requests'] = len(report.items)
        stats['bytes'] = int(report.bytes_downloaded or 0)
        if max_requests and stats['requests'] > max_requests:
            return JobResult(
                status=AcquisitionJob.Status.FAILED,
                error='max_total_requests exceeded',
                error_code='BUDGET_REQUESTS',
                stats=stats,
                cursor=cursor,
            )
        if max_bytes and stats['bytes'] > max_bytes:
            return JobResult(
                status=AcquisitionJob.Status.FAILED,
                error='max_total_bytes exceeded',
                error_code='BUDGET_BYTES',
                stats=stats,
                cursor=cursor,
            )

        pause_triggered = False
        stop_triggered = False
        stop_code = ''
        pause_code = ''

        for idx, row in enumerate(report.items):
            absolute_index = start_index + idx
            key = str(row.get('key') or f'item-{absolute_index}')[:255]
            acq_item, _ = AcquisitionItem.objects.get_or_create(
                job=job,
                external_key=key,
                defaults={'spec_json': row},
            )
            acq_item.attempt_count = (acq_item.attempt_count or 0) + 1
            acq_item.spec_json = row

            status = row.get('status')
            fail_code = _normalize_failure_code(row.get('failure_code') or row.get('detail'))

            if status == 'paused' or fail_code.lower() in pause_on:
                acq_item.status = AcquisitionItem.Status.FAILED
                acq_item.failure_code = fail_code
                acq_item.failure_reason = row.get('detail') or fail_code
                acq_item.save()
                stats['paused'] += 1
                pause_triggered = True
                pause_code = fail_code
                cursor['next_index'] = absolute_index  # retry this item on resume
                break

            if status != 'ok':
                acq_item.status = AcquisitionItem.Status.FAILED
                acq_item.failure_code = fail_code
                acq_item.failure_reason = row.get('detail') or fail_code
                acq_item.save()
                stats['failed'] += 1
                cursor['next_index'] = absolute_index + 1
                if fail_code.lower() in stop_on or fail_code in stop_on:
                    stop_triggered = True
                    stop_code = fail_code
                    break
                continue

            # Defer import until we collect ok rows; mark running then update after import.
            acq_item.status = AcquisitionItem.Status.RUNNING
            acq_item.failure_code = ''
            acq_item.failure_reason = ''
            acq_item.save()
            cursor['next_index'] = absolute_index + 1

        if pause_triggered:
            return JobResult(
                status=AcquisitionJob.Status.PAUSED,
                error=f'paused on {pause_code}',
                error_code=pause_code,
                stats=stats,
                cursor=cursor,
            )

        ok_rows = [r for r in report.items if r.get('status') == 'ok']
        # If stop triggered mid-batch, only import ok rows before stop.
        if stop_triggered:
            ok_keys = set()
            for r in report.items:
                fc = _normalize_failure_code(r.get('failure_code') or r.get('detail')).lower()
                if r.get('status') == 'ok':
                    ok_keys.add(r.get('key'))
                if fc in stop_on or (r.get('failure_code') or '') in stop_on:
                    break
            ok_rows = [r for r in ok_rows if r.get('key') in ok_keys]

        if ok_rows:
            try:
                manifest_path = _build_manifest(
                    contract=contract,
                    policy=policy,
                    fetched_ok=ok_rows,
                    files_root=files_root,
                )
                import_report = import_local_manifest(
                    organization=job.organization,
                    owner=owner,
                    manifest_path=manifest_path,
                    files_root=files_root,
                    dry_run=bool(job.dry_run),
                )
            except ImportManifestError as exc:
                return JobResult(
                    status=AcquisitionJob.Status.FAILED,
                    error=str(exc),
                    error_code=exc.code,
                    stats=stats,
                    cursor=cursor,
                )

            by_name = {Path(i.path).name: i for i in import_report.items}
            for row in ok_rows:
                key = str(row.get('key') or '')[:255]
                acq_item = AcquisitionItem.objects.filter(job=job, external_key=key).first()
                if not acq_item:
                    continue
                imp = by_name.get(Path(row['path']).name)
                if not imp:
                    acq_item.status = AcquisitionItem.Status.FAILED
                    acq_item.failure_code = 'IMPORT_MISSING'
                    acq_item.failure_reason = 'import result missing'
                    acq_item.save()
                    stats['failed'] += 1
                    continue
                if imp.status == 'created':
                    acq_item.status = AcquisitionItem.Status.SUCCEEDED
                    if imp.revision_id:
                        acq_item.revision_id = imp.revision_id
                    acq_item.failure_code = ''
                    acq_item.failure_reason = ''
                    stats['succeeded'] += 1
                elif imp.status in ('skipped', 'would_skip'):
                    acq_item.status = AcquisitionItem.Status.SKIPPED
                    acq_item.failure_reason = imp.detail or 'idempotent'
                    stats['skipped'] += 1
                elif imp.status == 'would_create':
                    acq_item.status = AcquisitionItem.Status.SUCCEEDED
                    acq_item.failure_reason = 'dry_run'
                    stats['succeeded'] += 1
                else:
                    acq_item.status = AcquisitionItem.Status.FAILED
                    acq_item.failure_code = 'IMPORT_ITEM_FAILED'
                    acq_item.failure_reason = imp.detail or imp.status
                    stats['failed'] += 1
                acq_item.save()

        if stop_triggered:
            return JobResult(
                status=AcquisitionJob.Status.FAILED,
                error=f'stop_on {stop_code}',
                error_code=stop_code,
                stats=stats,
                cursor=cursor,
            )

        if stats['failed'] and not stats['succeeded'] and not stats['skipped']:
            status = AcquisitionJob.Status.FAILED
            err = 'all items failed'
            code = 'ALL_FAILED'
        else:
            status = AcquisitionJob.Status.SUCCEEDED
            err = ''
            code = ''
        return JobResult(status=status, stats=stats, error=err, error_code=code, cursor=cursor)
