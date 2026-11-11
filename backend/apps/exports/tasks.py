from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='exports.dispatch_queued_export', bind=True, max_retries=3, queue='export')
def dispatch_queued_export(self, job_id: str):
    from apps.exports.services import ExportJobError, process_export_job

    try:
        return process_export_job(job_id)
    except ExportJobError as exc:
        logger.warning('export job failed %s: %s', job_id, exc)
        return {'job_id': job_id, 'error': exc.code}
    except Exception as exc:  # noqa: BLE001
        logger.exception('export job crashed %s', job_id)
        raise self.retry(exc=exc, countdown=5)
