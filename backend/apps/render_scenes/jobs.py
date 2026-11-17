from __future__ import annotations

import copy
import time
import uuid

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.assets.models import Asset
from apps.assets.services import absolute_path, store_render_input
from apps.billing.errors import BillingError
from apps.billing.models import ExportGrant
from apps.billing.services import consume_export, refund_export_grant
from apps.render_scenes.client import RenderServiceError, call_render
from apps.render_scenes.document import create_default_scene, upgrade_scene_to_v2
from apps.render_scenes.errors import RenderSceneError
from apps.render_scenes.glb import validate_glb
from apps.render_scenes.models import RenderBatch, RenderEnvironment, RenderJob, RenderScene
from apps.render_scenes.result_files import delete_result, resolve_result_path, write_result
from apps.render_scenes.serializers import RenderBatchSerializer, RenderJobSerializer


def serialize_job(job: RenderJob) -> dict:
    return RenderJobSerializer(job).data


def serialize_batch(batch: RenderBatch) -> dict:
    return RenderBatchSerializer(batch).data


def _resolve_size(width, height) -> tuple[int, int, int]:
    try:
        w = int(width)
        h = int(height)
    except (TypeError, ValueError) as exc:
        raise RenderSceneError('width/height invalid', code='VALIDATION_ERROR', status=400) from exc
    if w < 256 or h < 256 or w > 4096 or h > 4096:
        raise RenderSceneError('width/height out of range', code='VALIDATION_ERROR', status=400)
    allow_4k = bool(getattr(settings, 'RENDER_ALLOW_4K', True))
    if (w > 2048 or h > 2048) and not allow_4k:
        raise RenderSceneError('4K render disabled', code='RENDER_4K_DISABLED', status=403)
    if max(w, h) > 2048:
        samples = int(getattr(settings, 'RENDER_SAMPLES_4K', 48))
    else:
        samples = int(getattr(settings, 'RENDER_SAMPLES_2K', 64))
    return w, h, samples


def _org_has_active_job(organization_id) -> bool:
    return RenderJob.objects.filter(
        organization_id=organization_id,
        status__in=(RenderJob.Status.QUEUED, RenderJob.Status.RUNNING),
    ).exists()


def _build_render_params(job: RenderJob) -> dict:
    snapshot = job.scene_snapshot if isinstance(job.scene_snapshot, dict) else {}
    snapshot = upgrade_scene_to_v2(snapshot)
    params = {
        'width': job.width,
        'height': job.height,
        'samples': job.samples,
        'format': job.format,
        'camera': snapshot.get('camera') or {},
        'light': snapshot.get('light') or {},
        'background': snapshot.get('background') or {},
        'ground': snapshot.get('ground') or {},
        'environment': snapshot.get('environment') or {},
        'unit_scale': 0.001,
    }
    env = params['environment'] if isinstance(params['environment'], dict) else {}
    hdr_id = env.get('hdrId')
    if hdr_id:
        env_row = RenderEnvironment.objects.select_related('asset').filter(pk=str(hdr_id)).first()
        if env_row and env_row.asset_id:
            path = absolute_path(env_row.asset)
            if path.exists():
                params['hdr_bytes'] = path.read_bytes()
                params['hdr_intensity'] = float(env.get('intensity') or env_row.default_intensity or 1.0)
                params['hdr_rotation'] = float(env.get('rotation') or 0)
                params['hdr_use_as_background'] = bool(env.get('useAsBackground'))
    return params


def create_render_job(
    *,
    scene: RenderScene,
    user,
    glb_bytes: bytes,
    width,
    height,
    format: str = 'png',
    scene_snapshot: dict | None = None,
    idempotency_key: str | None = None,
    batch: RenderBatch | None = None,
    view_id: str = '',
    skip_busy_check: bool = False,
    input_asset: Asset | None = None,
):
    fmt = (format or 'png').strip().lower()
    if fmt not in (RenderJob.Format.PNG, RenderJob.Format.JPG):
        raise RenderSceneError('format must be png|jpg', code='VALIDATION_ERROR', status=400)
    w, h, samples = _resolve_size(width, height)
    if input_asset is None:
        meta = validate_glb(glb_bytes)
    else:
        meta = {}

    if not skip_busy_check and _org_has_active_job(scene.organization_id):
        raise RenderSceneError(
            'organization already has an active render job',
            code='RENDER_BUSY',
            status=409,
        )

    key = (idempotency_key or '').strip() or f'render-{uuid.uuid4()}'
    existing = RenderJob.objects.filter(organization_id=scene.organization_id, idempotency_key=key).first()
    if existing:
        same = (
            existing.scene_id == scene.id
            and existing.width == w
            and existing.height == h
            and existing.format == fmt
            and (existing.view_id or '') == (view_id or '')
        )
        if not same:
            raise RenderSceneError(
                'idempotency key reuse with different payload',
                code='IDEMPOTENCY_CONFLICT',
                status=409,
            )
        return serialize_job(existing), 200, True

    snapshot = scene_snapshot if isinstance(scene_snapshot, dict) else (scene.content_json or create_default_scene())
    snapshot = upgrade_scene_to_v2(snapshot)

    with transaction.atomic():
        try:
            grant = consume_export(
                organization=scene.organization,
                actor=user,
                reason=ExportGrant.Reason.RENDER_EXPORT,
                format=fmt,
                meta={'scene_id': str(scene.id), 'width': w, 'height': h, 'view_id': view_id},
            )
        except BillingError as exc:
            raise RenderSceneError(
                str(exc),
                code=exc.code,
                status=exc.status,
                errors=exc.errors,
                data=exc.data,
            ) from exc

        if input_asset is None:
            input_asset = store_render_input(
                organization=scene.organization,
                owner=user,
                data=glb_bytes,
                filename='scene.glb',
                meta={'scene_id': str(scene.id), **meta},
            )
        job = RenderJob.objects.create(
            organization_id=scene.organization_id,
            scene=scene,
            owner=user,
            batch=batch,
            view_id=(view_id or '')[:64],
            status=RenderJob.Status.QUEUED,
            width=w,
            height=h,
            format=fmt,
            scene_snapshot=snapshot,
            input_asset=input_asset,
            idempotency_key=key,
            export_grant_id=grant['grant_id'],
            samples=samples,
        )

    job_id = str(job.id)
    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        process_render_job(job_id)
        job.refresh_from_db()
        return serialize_job(job), 202, False

    from apps.render_scenes.tasks import dispatch_queued_render

    transaction.on_commit(lambda: dispatch_queued_render.delay(job_id))
    return serialize_job(job), 202, False


def create_render_batch(
    *,
    scene: RenderScene,
    user,
    glb_bytes: bytes,
    width,
    height,
    format: str = 'png',
    view_ids: list[str],
    scene_snapshot: dict | None = None,
    idempotency_key: str | None = None,
):
    fmt = (format or 'png').strip().lower()
    if fmt not in (RenderJob.Format.PNG, RenderJob.Format.JPG):
        raise RenderSceneError('format must be png|jpg', code='VALIDATION_ERROR', status=400)
    w, h, samples = _resolve_size(width, height)
    meta = validate_glb(glb_bytes)

    snapshot = scene_snapshot if isinstance(scene_snapshot, dict) else (scene.content_json or create_default_scene())
    snapshot = upgrade_scene_to_v2(snapshot)
    views = snapshot.get('views') if isinstance(snapshot.get('views'), list) else []
    view_map = {str(v.get('id')): v for v in views if isinstance(v, dict) and v.get('id')}
    selected = [str(v) for v in (view_ids or []) if str(v) in view_map]
    if not selected:
        raise RenderSceneError('view_ids required', code='VALIDATION_ERROR', status=400)

    key = (idempotency_key or '').strip() or f'render-batch-{uuid.uuid4()}'
    existing = RenderBatch.objects.filter(organization_id=scene.organization_id, idempotency_key=key).first()
    if existing:
        return serialize_batch(existing), 200, True

    with transaction.atomic():
        input_asset = store_render_input(
            organization=scene.organization,
            owner=user,
            data=glb_bytes,
            filename='scene.glb',
            meta={'scene_id': str(scene.id), 'batch': True, **meta},
        )
        batch = RenderBatch.objects.create(
            organization_id=scene.organization_id,
            scene=scene,
            owner=user,
            status=RenderBatch.Status.QUEUED,
            width=w,
            height=h,
            format=fmt,
            view_ids=selected,
            shared_input_asset=input_asset,
            job_count=len(selected),
            idempotency_key=key,
        )

        # Create all jobs as queued; only dispatch the first if no active job.
        busy = _org_has_active_job(scene.organization_id)
        first_job_id = None
        for idx, vid in enumerate(selected):
            view = view_map[vid]
            snap = copy.deepcopy(snapshot)
            if isinstance(view.get('camera'), dict):
                snap['camera'] = copy.deepcopy(view['camera'])
            if isinstance(view.get('output'), dict) and view['output'].get('aspect'):
                snap.setdefault('output', {})
                snap['output']['aspect'] = view['output']['aspect']
            try:
                grant = consume_export(
                    organization=scene.organization,
                    actor=user,
                    reason=ExportGrant.Reason.RENDER_EXPORT,
                    format=fmt,
                    meta={'scene_id': str(scene.id), 'batch_id': str(batch.id), 'view_id': vid},
                )
            except BillingError as exc:
                # Refund already-created grants in this batch by failing remaining.
                raise RenderSceneError(
                    str(exc),
                    code=exc.code,
                    status=exc.status,
                    errors=exc.errors,
                    data=exc.data,
                ) from exc
            job = RenderJob.objects.create(
                organization_id=scene.organization_id,
                scene=scene,
                owner=user,
                batch=batch,
                view_id=vid,
                status=RenderJob.Status.QUEUED,
                width=w,
                height=h,
                format=fmt,
                scene_snapshot=snap,
                input_asset=input_asset,
                idempotency_key=f'{key}:{vid}',
                export_grant_id=grant['grant_id'],
                samples=samples,
            )
            if idx == 0 and not busy:
                first_job_id = str(job.id)

        batch.status = RenderBatch.Status.RUNNING if first_job_id else RenderBatch.Status.QUEUED
        batch.save(update_fields=['status', 'updated_at'])

    if first_job_id:
        if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
            process_render_job(first_job_id)
            # Drain remaining queued jobs in batch for eager mode
            while True:
                nxt = (
                    RenderJob.objects.filter(
                        batch_id=batch.id,
                        status=RenderJob.Status.QUEUED,
                    )
                    .order_by('created_at')
                    .first()
                )
                if not nxt:
                    break
                process_render_job(str(nxt.id))
            batch.refresh_from_db()
            return serialize_batch(batch), 202, False

        from apps.render_scenes.tasks import dispatch_queued_render

        transaction.on_commit(lambda: dispatch_queued_render.delay(first_job_id))

    batch.refresh_from_db()
    return serialize_batch(batch), 202, False


def _fail_job(job_id: str, *, code: str, message: str) -> dict:
    with transaction.atomic():
        locked = (
            RenderJob.objects.select_for_update(of=('self',))
            .select_related('organization', 'batch')
            .get(pk=job_id)
        )
        if locked.status == RenderJob.Status.CANCELLED:
            return serialize_job(locked)
        locked.status = RenderJob.Status.FAILED
        locked.error_code = str(code)[:64]
        locked.error_message = str(message)[:2000]
        locked.finished_at = timezone.now()
        locked.save(update_fields=['status', 'error_code', 'error_message', 'finished_at', 'updated_at'])
        if locked.export_grant_id:
            refund_export_grant(grant_id=locked.export_grant_id, organization=locked.organization)
        delete_result(locked.id, format=locked.format)
        _cleanup_input(locked)
        _update_batch_after_job(locked)
        _dispatch_next_queued(locked.organization_id)
        return serialize_job(locked)


def _cleanup_input(job: RenderJob) -> None:
    # Shared batch input is cleaned when batch finishes.
    if job.batch_id:
        return
    asset = job.input_asset
    if not asset:
        return
    still_used = RenderJob.objects.filter(input_asset_id=asset.id).exclude(pk=job.pk).exists()
    if still_used:
        return
    try:
        path = absolute_path(asset)
        if path.exists():
            path.unlink()
    except OSError:
        pass
    Asset.objects.filter(pk=asset.pk).delete()
    job.input_asset = None
    job.save(update_fields=['input_asset', 'updated_at'])


def _update_batch_after_job(job: RenderJob) -> None:
    if not job.batch_id:
        return
    batch = RenderBatch.objects.select_for_update().get(pk=job.batch_id)
    succeeded = batch.jobs.filter(status=RenderJob.Status.SUCCEEDED).count()
    failed = batch.jobs.filter(status=RenderJob.Status.FAILED).count()
    total = batch.job_count
    batch.succeeded_count = succeeded
    batch.failed_count = failed
    if succeeded + failed >= total:
        if failed == 0:
            batch.status = RenderBatch.Status.SUCCEEDED
        elif succeeded == 0:
            batch.status = RenderBatch.Status.FAILED
        else:
            batch.status = RenderBatch.Status.PARTIAL
        batch.finished_at = timezone.now()
        # Cleanup shared input
        if batch.shared_input_asset_id:
            asset = batch.shared_input_asset
            try:
                path = absolute_path(asset)
                if path.exists():
                    path.unlink()
            except OSError:
                pass
            Asset.objects.filter(pk=asset.pk).delete()
            batch.shared_input_asset = None
            batch.jobs.update(input_asset=None)
    elif batch.status == RenderBatch.Status.QUEUED:
        batch.status = RenderBatch.Status.RUNNING
    batch.save(
        update_fields=[
            'succeeded_count',
            'failed_count',
            'status',
            'finished_at',
            'shared_input_asset',
            'updated_at',
        ]
    )


def _dispatch_next_queued(organization_id) -> None:
    if RenderJob.objects.filter(
        organization_id=organization_id,
        status=RenderJob.Status.RUNNING,
    ).exists():
        return
    nxt = (
        RenderJob.objects.filter(
            organization_id=organization_id,
            status=RenderJob.Status.QUEUED,
        )
        .order_by('created_at')
        .first()
    )
    if not nxt:
        return
    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        process_render_job(str(nxt.id))
        return
    from apps.render_scenes.tasks import dispatch_queued_render

    dispatch_queued_render.delay(str(nxt.id))


def process_render_job(job_id: str) -> dict:
    with transaction.atomic():
        job = (
            RenderJob.objects.select_for_update(of=('self',))
            .select_related(
                'organization',
                'owner',
                'scene',
                'input_asset',
                'batch',
            )
            .get(pk=job_id)
        )
        if job.status == RenderJob.Status.SUCCEEDED and (
            job.checksum or resolve_result_path(job.id, format=job.format)
        ):
            return serialize_job(job)
        if job.status in (RenderJob.Status.CANCELLED, RenderJob.Status.FAILED):
            return serialize_job(job)
        # Ensure single runner per org
        other_running = (
            RenderJob.objects.filter(
                organization_id=job.organization_id,
                status=RenderJob.Status.RUNNING,
            )
            .exclude(pk=job.pk)
            .exists()
        )
        if other_running:
            return serialize_job(job)
        job.status = RenderJob.Status.RUNNING
        job.save(update_fields=['status', 'updated_at'])

    if not job.input_asset_id:
        return _fail_job(job_id, code='INPUT_MISSING', message='render input missing')

    path = absolute_path(job.input_asset)
    if not path.exists():
        return _fail_job(job_id, code='INPUT_MISSING', message='render input file missing')

    glb = path.read_bytes()
    params = _build_render_params(job)
    hdr_bytes = params.pop('hdr_bytes', None)

    started = time.monotonic()
    try:
        image_bytes = call_render(glb=glb, params=params, hdr=hdr_bytes)
        _path, checksum = write_result(job.id, data=image_bytes, format=job.format)
    except (RenderServiceError, OSError, ValueError) as exc:
        code = getattr(exc, 'code', 'RENDER_FAILED')
        delete_result(job_id, format=job.format)
        return _fail_job(job_id, code=str(code), message=str(exc))
    except Exception as exc:  # noqa: BLE001
        delete_result(job_id, format=job.format)
        _fail_job(job_id, code='RENDER_CRASH', message=str(exc))
        raise

    duration_ms = int((time.monotonic() - started) * 1000)
    with transaction.atomic():
        locked = (
            RenderJob.objects.select_for_update(of=('self',))
            .select_related('batch')
            .get(pk=job_id)
        )
        if locked.status == RenderJob.Status.CANCELLED:
            delete_result(job_id, format=locked.format)
            return serialize_job(locked)
        locked.status = RenderJob.Status.SUCCEEDED
        locked.result_asset = None
        locked.checksum = checksum
        locked.error_code = ''
        locked.error_message = ''
        locked.duration_ms = duration_ms
        locked.finished_at = timezone.now()
        locked.save(
            update_fields=[
                'status',
                'result_asset',
                'checksum',
                'error_code',
                'error_message',
                'duration_ms',
                'finished_at',
                'updated_at',
            ]
        )
        _cleanup_input(locked)
        _update_batch_after_job(locked)
        _dispatch_next_queued(locked.organization_id)
        return serialize_job(locked)
