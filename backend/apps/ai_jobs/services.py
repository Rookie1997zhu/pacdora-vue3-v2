from __future__ import annotations

import copy
import hashlib
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.utils import timezone

from apps.ai_jobs.capabilities import assert_operation_enabled, provider_name
from apps.ai_jobs.errors import AiJobError
from apps.ai_jobs.models import AiJob, UsageLedger, UsageReservation
from apps.ai_jobs.providers import get_provider
from apps.ai_jobs.providers.base import ProviderError
from apps.assets.models import Asset, AssetReference
from apps.assets.services import store_upload
from apps.designs.models import Design, OutboxEvent
from apps.designs.services import DesignServiceError, save_revision

__all__ = ['AiJobError', 'serialize_job', 'create_ai_job', 'cancel_ai_job', 'process_ai_job', 'apply_ai_job']


def serialize_job(job: AiJob) -> dict:
    return {
        'id': str(job.id),
        'design_id': str(job.design_id),
        'input_revision_id': str(job.input_revision_id),
        'operation': job.operation,
        'status': job.status,
        'prompt': job.prompt,
        'provider': job.provider,
        'result_asset_id': str(job.result_asset_id) if job.result_asset_id else None,
        'error_code': job.error_code or None,
        'error_message': job.error_message or None,
        'created_at': job.created_at.isoformat() if job.created_at else None,
        'updated_at': job.updated_at.isoformat() if job.updated_at else None,
        'finished_at': job.finished_at.isoformat() if job.finished_at else None,
    }


def create_ai_job(
    *,
    design: Design,
    user,
    operation: str,
    prompt: str,
    idempotency_key: str | None,
    registration=None,
):
    from apps.ai_jobs.masks import validate_registration_payload

    if design.status != Design.Status.ACTIVE:
        raise AiJobError('design archived', code='DESIGN_ARCHIVED', status=400)
    if not design.current_revision_id:
        raise AiJobError('design has no revision', code='NO_REVISION', status=400)

    operation = (operation or '').strip()
    prompt = (prompt or '').strip()
    assert_operation_enabled(operation)
    if not prompt:
        raise AiJobError('prompt required', code='VALIDATION_ERROR', status=400)
    if len(prompt) > 4000:
        raise AiJobError('prompt too long', code='VALIDATION_ERROR', status=400)

    meta: dict = {}
    if operation == AiJob.Operation.MAIN_AREA_GENERATE:
        if registration is None:
            raise AiJobError('registration required for main_area_generate', code='VALIDATION_ERROR', status=400)
        content = design.current_revision.content_json if design.current_revision_id else {}
        geom = content.get('geometry') if isinstance(content, dict) else {}
        expected_hash = str((geom or {}).get('geometryHash') or '')
        validated = validate_registration_payload(registration, expected_geometry_hash=expected_hash)
        meta = {
            'registration': registration if isinstance(registration, dict) else validated,
            'maskHash': validated['maskHash'],
            'geometryHash': validated['geometryHash'],
        }
    elif registration is not None:
        raise AiJobError('registration only allowed for main_area_generate', code='VALIDATION_ERROR', status=400)

    key = (idempotency_key or '').strip() or f'ai-{uuid.uuid4()}'
    existing = AiJob.objects.filter(organization_id=design.organization_id, idempotency_key=key).first()
    if existing:
        existing_mask = (existing.meta or {}).get('maskHash')
        new_mask = meta.get('maskHash')
        if (
            existing.design_id != design.id
            or existing.operation != operation
            or existing.prompt != prompt
            or existing_mask != new_mask
        ):
            raise AiJobError(
                'idempotency key reuse with different payload',
                code='IDEMPOTENCY_CONFLICT',
                status=409,
            )
        return serialize_job(existing), 200, True

    with transaction.atomic():
        job = AiJob.objects.create(
            organization_id=design.organization_id,
            design=design,
            input_revision_id=design.current_revision_id,
            owner=user,
            operation=operation,
            status=AiJob.Status.QUEUED,
            prompt=prompt,
            idempotency_key=key,
            provider=provider_name(),
            meta=meta,
        )
        UsageReservation.objects.create(
            organization_id=design.organization_id,
            job=job,
            units=1,
            status=UsageReservation.Status.HELD,
        )
        OutboxEvent.objects.create(
            event_type='ai.job_queued',
            payload={'job_id': str(job.id), 'organization_id': str(design.organization_id)},
        )

    job_id = str(job.id)
    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        process_ai_job(job_id)
        job.refresh_from_db()
        return serialize_job(job), 202, False

    from apps.ai_jobs.tasks import dispatch_queued_job

    transaction.on_commit(lambda: dispatch_queued_job.delay(job_id))
    return serialize_job(job), 202, False


def cancel_ai_job(*, job: AiJob) -> dict:
    with transaction.atomic():
        locked = AiJob.objects.select_for_update().get(pk=job.pk)
        if locked.status in (AiJob.Status.SUCCEEDED, AiJob.Status.FAILED, AiJob.Status.CANCELLED):
            return serialize_job(locked)
        if locked.status not in (AiJob.Status.QUEUED, AiJob.Status.RUNNING):
            raise AiJobError('cannot cancel', code='INVALID_STATE', status=400)
        locked.status = AiJob.Status.CANCELLED
        locked.finished_at = timezone.now()
        locked.save(update_fields=['status', 'finished_at', 'updated_at'])
        res = getattr(locked, 'reservation', None)
        if res and res.status == UsageReservation.Status.HELD:
            res.status = UsageReservation.Status.RELEASED
            res.save(update_fields=['status', 'updated_at'])
        return serialize_job(locked)


def process_ai_job(job_id: str) -> dict:
    with transaction.atomic():
        job = AiJob.objects.select_for_update().select_related('reservation', 'owner', 'organization').get(pk=job_id)
        if job.status == AiJob.Status.SUCCEEDED and job.result_asset_id:
            return serialize_job(job)
        if job.status in (AiJob.Status.CANCELLED, AiJob.Status.FAILED):
            return serialize_job(job)
        if job.status == AiJob.Status.RUNNING and job.result_asset_id:
            return serialize_job(job)
        job.status = AiJob.Status.RUNNING
        job.lease_until = timezone.now() + timedelta(minutes=5)
        job.save(update_fields=['status', 'lease_until', 'updated_at'])

    try:
        from apps.ai_jobs.masks import rasterize_mask_png

        provider = get_provider()
        prompt = job.prompt
        mask_png = None
        if job.operation == AiJob.Operation.MAIN_AREA_GENERATE:
            prompt = (
                f'{job.prompt}\n\n'
                'Flat packaging dieline layout, full unfolded net, print-ready artwork, no text.\n'
                'The attached black-and-white mask marks the primary print region in white; '
                'keep key artwork inside white areas and avoid placing important content on black.'
            )
            reg = (job.meta or {}).get('registration')
            if not isinstance(reg, dict):
                raise ProviderError('missing registration on job', code='VALIDATION_ERROR', status=400)
            mask_png = rasterize_mask_png(reg, which='main')
        raw = provider.generate_image(
            prompt,
            job_id=str(job.id),
            mask_png=mask_png,
            mask_mime='image/png' if mask_png else None,
        )
        if not raw:
            raise ProviderError('empty image', code='PROVIDER_BAD_RESPONSE', status=502)
        if raw.startswith(b'\x89PNG\r\n\x1a\n'):
            mime, ext = 'image/png', 'png'
        elif raw[:2] == b'\xff\xd8':
            mime, ext = 'image/jpeg', 'jpg'
        else:
            mime, ext = 'image/png', 'png'
        uploaded = SimpleUploadedFile(
            name=f'ai-{job.id}.{ext}',
            content=raw,
            content_type=mime,
        )
        asset = store_upload(organization=job.organization, owner=job.owner, uploaded_file=uploaded)
        Asset.objects.filter(pk=asset.pk).update(source='ai_generate', meta={'ai_job_id': str(job.id)})
        asset.refresh_from_db()
    except ProviderError as exc:
        with transaction.atomic():
            locked = AiJob.objects.select_for_update().get(pk=job_id)
            if locked.status == AiJob.Status.CANCELLED:
                return serialize_job(locked)
            locked.status = AiJob.Status.FAILED
            locked.error_code = exc.code
            locked.error_message = str(exc)[:2000]
            locked.finished_at = timezone.now()
            locked.save(update_fields=['status', 'error_code', 'error_message', 'finished_at', 'updated_at'])
            res = getattr(locked, 'reservation', None)
            if res and res.status == UsageReservation.Status.HELD:
                res.status = UsageReservation.Status.RELEASED
                res.save(update_fields=['status', 'updated_at'])
        raise AiJobError(str(exc), code=exc.code, status=exc.status) from exc
    except Exception as exc:  # noqa: BLE001
        with transaction.atomic():
            locked = AiJob.objects.select_for_update().get(pk=job_id)
            if locked.status == AiJob.Status.CANCELLED:
                return serialize_job(locked)
            locked.status = AiJob.Status.FAILED
            locked.error_code = 'PROVIDER_ERROR'
            locked.error_message = str(exc)[:2000]
            locked.finished_at = timezone.now()
            locked.save(update_fields=['status', 'error_code', 'error_message', 'finished_at', 'updated_at'])
            res = getattr(locked, 'reservation', None)
            if res and res.status == UsageReservation.Status.HELD:
                res.status = UsageReservation.Status.RELEASED
                res.save(update_fields=['status', 'updated_at'])
        raise

    with transaction.atomic():
        locked = AiJob.objects.select_for_update().select_related('reservation').get(pk=job_id)
        if locked.status == AiJob.Status.CANCELLED:
            # Late result: keep cancelled, do not settle
            return serialize_job(locked)
        if locked.status == AiJob.Status.SUCCEEDED and locked.result_asset_id:
            return serialize_job(locked)
        locked.status = AiJob.Status.SUCCEEDED
        locked.result_asset = asset
        locked.provider_request_id = hashlib.sha256(str(job.id).encode()).hexdigest()[:32]
        locked.finished_at = timezone.now()
        locked.error_code = ''
        locked.error_message = ''
        locked.save(
            update_fields=[
                'status',
                'result_asset',
                'provider_request_id',
                'finished_at',
                'error_code',
                'error_message',
                'updated_at',
            ]
        )
        res = locked.reservation
        if res.status == UsageReservation.Status.HELD:
            res.status = UsageReservation.Status.SETTLED
            res.save(update_fields=['status', 'updated_at'])
            ledger_reason = (
                'ai_main_area_generate'
                if locked.operation == AiJob.Operation.MAIN_AREA_GENERATE
                else 'ai_image_generate'
            )
            UsageLedger.objects.get_or_create(
                organization_id=locked.organization_id,
                job=locked,
                reason=ledger_reason,
                defaults={'delta': -int(res.units)},
            )
        AssetReference.objects.get_or_create(
            asset=asset,
            ref_type='ai_job',
            ref_id=str(locked.id),
        )
        OutboxEvent.objects.filter(
            event_type='ai.job_queued',
            payload__job_id=str(locked.id),
            status=OutboxEvent.Status.PENDING,
        ).update(status=OutboxEvent.Status.SENT, sent_at=timezone.now())
        return serialize_job(locked)


def _geometry_fingerprint(content: dict) -> str | None:
    geom = content.get('geometry') or {}
    params = geom.get('params') or {}
    source_hash = '|'.join(
        [
            str(geom.get('templateId') or ''),
            str(params.get('lengthMm') or ''),
            str(params.get('widthMm') or ''),
            str(params.get('heightMm') or ''),
            str(params.get('thicknessMm') or ''),
            str(params.get('bleedInputMm') or ''),
            str(params.get('sizeMode') or ''),
            str(params.get('fluteDirection') or ''),
        ]
    )
    return source_hash or None


def _parse_mm(value, *, field: str, default: float | None = None, min_value: float = 0.1) -> float:
    if value is None or value == '':
        if default is None:
            raise AiJobError(f'{field} required', code='VALIDATION_ERROR', status=400)
        return float(default)
    try:
        n = float(value)
    except (TypeError, ValueError) as exc:
        raise AiJobError(f'{field} invalid', code='VALIDATION_ERROR', status=400) from exc
    if n < min_value:
        raise AiJobError(f'{field} out of range', code='VALIDATION_ERROR', status=400)
    return n


def apply_ai_job(
    *,
    job: AiJob,
    user,
    expected_row_version: int,
    panel_id: str = '',
    side: str = 'outside',
    width_mm=None,
    height_mm=None,
    origin_x_mm=None,
    origin_y_mm=None,
    registration=None,
):
    if job.status != AiJob.Status.SUCCEEDED or not job.result_asset_id:
        raise AiJobError('job has no result', code='JOB_NOT_READY', status=400)
    design = Design.objects.select_related('current_revision').get(pk=job.design_id)
    if design.status != Design.Status.ACTIVE:
        raise AiJobError('design archived', code='DESIGN_ARCHIVED', status=400)
    if not design.current_revision_id:
        raise AiJobError('design has no revision', code='NO_REVISION', status=400)

    side_norm = (side or 'outside').strip().lower()
    if side_norm not in ('outside', 'inside'):
        side_norm = 'outside'

    content = copy.deepcopy(design.current_revision.content_json)
    layers = content.setdefault('artwork', {}).setdefault('layers', [])
    z = (max([l.get('zIndex', 0) for l in layers], default=0) or 0) + 1
    source_hash = _geometry_fingerprint(content)
    is_main_area = job.operation == AiJob.Operation.MAIN_AREA_GENERATE

    registration_payload = None
    if registration is not None:
        if not isinstance(registration, dict):
            raise AiJobError('registration must be an object', code='VALIDATION_ERROR', status=400)
        geom = content.get('geometry') if isinstance(content.get('geometry'), dict) else {}
        current_hash = str(geom.get('geometryHash') or '')
        reg_hash = str(registration.get('geometryHash') or '')
        if reg_hash and current_hash and reg_hash != current_hash:
            raise AiJobError(
                'registration geometryHash does not match current revision',
                code='GEOMETRY_MISMATCH',
                status=400,
                data={'expected': current_hash, 'got': reg_hash},
            )
        registration_payload = registration

    if is_main_area:
        w = _parse_mm(width_mm, field='width_mm', min_value=1)
        h = _parse_mm(height_mm, field='height_mm', min_value=1)
        ox = _parse_mm(origin_x_mm, field='origin_x_mm', default=0, min_value=-1e6)
        oy = _parse_mm(origin_y_mm, field='origin_y_mm', default=0, min_value=-1e6)
        # Keep net layers under panel stickers when both exist.
        net_z = min((l.get('zIndex', 1) for l in layers), default=1) - 1
        layer = {
            'id': str(uuid.uuid4()),
            'kind': 'image',
            'name': f'ai-net-{str(job.id)[:8]}',
            'coordinateSpace': 'net_mm',
            'panelId': None,
            'pieceId': None,
            'side': side_norm,
            'transform': {'xMm': ox, 'yMm': oy, 'rotationDeg': 0, 'scaleX': 1, 'scaleY': 1},
            'widthMm': w,
            'heightMm': h,
            'visible': True,
            'locked': False,
            'opacity': 1,
            'zIndex': net_z,
            'clip': 'printable',
            'assetId': str(job.result_asset_id),
            'text': None,
            'shape': None,
            'crop': None,
            'resizePolicy': 'keep_mm',
            'anchor': None,
            'sourceGeometryHash': source_hash,
            'adaptStatus': 'ok',
        }
        ai_mode = 'main_area'
    else:
        panel_id = (panel_id or '').strip()
        if not panel_id:
            raise AiJobError('panel_id required', code='VALIDATION_ERROR', status=400)
        layer = {
            'id': str(uuid.uuid4()),
            'kind': 'image',
            'name': f'ai-{str(job.id)[:8]}',
            'coordinateSpace': 'panel_mm',
            'panelId': panel_id,
            'pieceId': None,
            'side': side_norm,
            'transform': {'xMm': 10, 'yMm': 10, 'rotationDeg': 0, 'scaleX': 1, 'scaleY': 1},
            'widthMm': 50,
            'heightMm': 50,
            'visible': True,
            'locked': False,
            'opacity': 1,
            'zIndex': z,
            'clip': 'panel',
            'assetId': str(job.result_asset_id),
            'text': None,
            'shape': None,
            'crop': None,
            'resizePolicy': 'keep_mm',
            'anchor': None,
            'sourceGeometryHash': source_hash,
            'adaptStatus': 'ok',
        }
        ai_mode = 'image'

    layers.append(layer)
    prev_ai = content.get('aiSettings') if isinstance(content.get('aiSettings'), dict) else {}
    next_ai = {
        **prev_ai,
        'mode': ai_mode,
        'prompt': job.prompt[:4000],
        'stylePresetId': prev_ai.get('stylePresetId'),
        'generationBackgroundColor': prev_ai.get('generationBackgroundColor'),
    }
    if is_main_area and registration_payload is not None:
        next_ai['registration'] = registration_payload
    content['aiSettings'] = next_ai

    try:
        # No fixed Idempotency-Key: stale row_version must surface DESIGN_VERSION_CONFLICT
        data, status, _ = save_revision(
            design=design,
            user=user,
            content=content,
            expected_row_version=expected_row_version,
            idempotency_key=None,
        )
    except DesignServiceError as exc:
        raise AiJobError(str(exc), code=exc.code, status=exc.status, errors=exc.errors, data=exc.data) from exc
    return data, status
