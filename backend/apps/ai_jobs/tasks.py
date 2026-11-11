from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='ai_jobs.dispatch_queued_job', bind=True, max_retries=3)
def dispatch_queued_job(self, job_id: str):
    from apps.ai_jobs.services import AiJobError, process_ai_job

    try:
        return process_ai_job(job_id)
    except AiJobError as exc:
        logger.warning('ai job failed %s: %s', job_id, exc)
        return {'job_id': job_id, 'error': exc.code}
    except Exception as exc:  # noqa: BLE001
        logger.exception('ai job crashed %s', job_id)
        raise self.retry(exc=exc, countdown=5)


@shared_task(name='ai_jobs.drain_outbox')
def drain_ai_outbox(limit: int = 20):
    from apps.designs.models import OutboxEvent

    rows = (
        OutboxEvent.objects.filter(event_type='ai.job_queued', status=OutboxEvent.Status.PENDING)
        .order_by('available_at')[:limit]
    )
    count = 0
    for row in rows:
        job_id = (row.payload or {}).get('job_id')
        if job_id:
            dispatch_queued_job.delay(str(job_id))
            count += 1
    return {'dispatched': count}
