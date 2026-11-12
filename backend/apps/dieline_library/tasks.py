from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='dieline_library.dispatch_acquisition_job', bind=True, max_retries=2, queue='import')
def dispatch_acquisition_job(self, job_id: str):
    from apps.dieline_library.services.adapters.base import AdapterError
    from apps.dieline_library.services.adapters.runner import process_job

    try:
        return process_job(job_id)
    except AdapterError as exc:
        logger.warning('acquisition job failed %s: %s', job_id, exc)
        return {'job_id': job_id, 'error': exc.code}
    except Exception as exc:  # noqa: BLE001
        logger.exception('acquisition job crashed %s', job_id)
        raise self.retry(exc=exc, countdown=5)
