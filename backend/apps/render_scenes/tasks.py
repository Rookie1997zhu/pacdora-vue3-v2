from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='render_scenes.dispatch_queued_render', bind=True, max_retries=2, queue='render')
def dispatch_queued_render(self, job_id: str):
    from apps.render_scenes.errors import RenderSceneError
    from apps.render_scenes.jobs import process_render_job

    try:
        return process_render_job(job_id)
    except RenderSceneError as exc:
        logger.warning('render job failed %s: %s', job_id, exc)
        return {'job_id': job_id, 'error': exc.code}
    except Exception as exc:  # noqa: BLE001
        logger.exception('render job crashed %s', job_id)
        raise self.retry(exc=exc, countdown=10)
