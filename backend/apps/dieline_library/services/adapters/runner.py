from __future__ import annotations

import uuid
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.dieline_library.models import AcquisitionJob, AcquisitionPlan
from apps.dieline_library.services.adapters.base import AdapterDisabled, AdapterError, DryRunReport, JobResult
from apps.dieline_library.services.adapters.registry import get_adapter


def validate_plan(plan: AcquisitionPlan, *, owner=None):
    if owner is not None:
        plan._owner = owner
    adapter = get_adapter(plan.adapter_type)
    return adapter.validate(plan)


def dry_run_plan(plan: AcquisitionPlan, *, owner=None) -> DryRunReport:
    if owner is not None:
        plan._owner = owner
    adapter = get_adapter(plan.adapter_type)
    return adapter.dry_run(plan)


def create_job(
    *,
    plan: AcquisitionPlan,
    owner,
    dry_run: bool = True,
    idempotency_key: str | None = None,
) -> AcquisitionJob:
    key = idempotency_key or f'acq:{plan.id}:{dry_run}:{uuid.uuid4()}'
    existing = AcquisitionJob.objects.filter(idempotency_key=key).first()
    if existing:
        return existing
    return AcquisitionJob.objects.create(
        plan=plan,
        organization=plan.organization,
        dry_run=dry_run,
        status=AcquisitionJob.Status.PENDING,
        stats_json={},
        cursor_json={},
        idempotency_key=key,
        created_by_id=getattr(owner, 'id', None),
    )


def process_job(job_id: str) -> dict[str, Any]:
    with transaction.atomic():
        job = (
            AcquisitionJob.objects.select_for_update()
            .select_related('plan', 'organization')
            .filter(id=job_id)
            .first()
        )
        if not job:
            raise AdapterError('job not found', code='JOB_MISSING')
        if job.status in (
            AcquisitionJob.Status.SUCCEEDED,
            AcquisitionJob.Status.CANCELLED,
        ):
            return {'job_id': str(job.id), 'status': job.status, 'stats': job.stats_json}
        job.status = AcquisitionJob.Status.RUNNING
        job.started_at = job.started_at or timezone.now()
        job.last_error = ''
        job.last_error_code = ''
        job.save(update_fields=['status', 'started_at', 'last_error', 'last_error_code', 'updated_at'])

    plan = job.plan
    owner = None
    if job.created_by_id:
        from apps.accounts.models import User

        owner = User.objects.filter(id=job.created_by_id).first()
    if owner is not None:
        plan._owner = owner

    adapter = get_adapter(plan.adapter_type)
    try:
        result: JobResult = adapter.resume(job) if job.cursor_json else adapter.execute(job)
    except AdapterDisabled as exc:
        result = JobResult(
            status=AcquisitionJob.Status.FAILED,
            error=str(exc),
            error_code=exc.code,
            stats={'planned': 0, 'succeeded': 0, 'failed': 1, 'skipped': 0, 'bytes': 0},
        )
    except AdapterError as exc:
        result = JobResult(
            status=AcquisitionJob.Status.FAILED,
            error=str(exc),
            error_code=exc.code,
        )
    except Exception as exc:  # noqa: BLE001
        result = JobResult(
            status=AcquisitionJob.Status.FAILED,
            error=str(exc),
            error_code='JOB_CRASH',
        )

    job.refresh_from_db()
    job.status = result.status
    job.stats_json = result.stats or job.stats_json or {}
    job.cursor_json = result.cursor or job.cursor_json or {}
    job.last_error = result.error or ''
    job.last_error_code = result.error_code or ''
    job.finished_at = timezone.now()
    job.save(
        update_fields=[
            'status',
            'stats_json',
            'cursor_json',
            'last_error',
            'last_error_code',
            'finished_at',
            'updated_at',
        ]
    )
    return {
        'job_id': str(job.id),
        'status': job.status,
        'stats': job.stats_json,
        'error': job.last_error,
        'error_code': job.last_error_code,
    }


def enqueue_job(job: AcquisitionJob) -> None:
    from apps.dieline_library.tasks import dispatch_acquisition_job

    transaction.on_commit(lambda: dispatch_acquisition_job.delay(str(job.id)))
