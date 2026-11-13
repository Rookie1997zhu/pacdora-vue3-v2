from __future__ import annotations

import base64
import uuid

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.assets.models import AssetReference
from apps.assets.services import AssetUploadError, store_bytes
from apps.catalog.manufacturing import find_template_approval
from apps.designs.models import Design, DesignRevision, OutboxEvent
from apps.designs.services import DesignServiceError, resolve_template
from apps.exports.engineering_domain import check_engineering_domain
from apps.exports.errors import ExportJobError
from apps.exports.models import ExportJob
from apps.geometry_api.client import GeometryServiceError, export_dieline, validate_geometry
from apps.samples.services import find_matching_sample_pass

EXPORTER_VERSION = 'boxcraft.export.v1'
LICENSE_NOTE = {'code': 'B-GEOM-LICENSE', 'status': 'open'}
ENGINEERING_DISCLAIMER = (
    'ENGINEERING CANDIDATE · COMPENSATION UNVERIFIED · NOT FOR PRODUCTION DIE'
)

__all__ = [
    'ExportJobError',
    'EXPORTER_VERSION',
    'serialize_job',
    'evaluate_manufacturing_gate',
    'evaluate_engineering_gate',
    'create_export_job',
    'process_export_job',
]


def serialize_job(job: ExportJob) -> dict:
    return {
        'id': str(job.id),
        'design_id': str(job.design_id),
        'input_revision_id': str(job.input_revision_id),
        'format': job.format,
        'quality_tier': job.quality_tier,
        'status': job.status,
        'content_hash': job.content_hash or None,
        'geometry_hash': job.geometry_hash or None,
        'engine_version': job.engine_version or None,
        'exporter_version': job.exporter_version or None,
        'preflight': job.preflight or {},
        'result_asset_id': str(job.result_asset_id) if job.result_asset_id else None,
        'checksum': job.checksum or None,
        'error_code': job.error_code or None,
        'error_message': job.error_message or None,
        'created_at': job.created_at.isoformat() if job.created_at else None,
        'updated_at': job.updated_at.isoformat() if job.updated_at else None,
        'finished_at': job.finished_at.isoformat() if job.finished_at else None,
    }


def _resolve_revision(design: Design, revision_id: str | None) -> DesignRevision:
    if not design.current_revision_id and not revision_id:
        raise ExportJobError('design has no revision', code='NO_REVISION', status=400)
    if revision_id:
        rev = DesignRevision.objects.filter(id=revision_id, design_id=design.id).first()
        if not rev:
            raise ExportJobError('revision not found for design', code='REVISION_NOT_FOUND', status=400)
        return rev
    return design.current_revision


def _geometry_payload_from_revision(revision: DesignRevision) -> dict:
    content = revision.content_json or {}
    geom = content.get('geometry') or {}
    params = geom.get('params') or {}
    return {
        'template_id': geom.get('templateId'),
        'length_mm': params.get('lengthMm'),
        'width_mm': params.get('widthMm'),
        'height_mm': params.get('heightMm'),
        'thickness_mm': params.get('thicknessMm'),
        'bleed_mm': params.get('bleedInputMm'),
        'size_mode': params.get('sizeMode') or 'inner',
        'flute_direction': params.get('fluteDirection') or 'L',
        'material_id': params.get('materialId') or 'kraft',
        'params': params.get('advanced') or {},
    }


def _resolve_template_version(revision: DesignRevision, template_id: str):
    try:
        tpl, ver = resolve_template(template_id)
    except DesignServiceError as exc:
        raise ExportJobError(str(exc), code=exc.code, status=exc.status) from exc
    pinned = None
    if revision.template_version:
        pinned = tpl.versions.filter(version=revision.template_version).first()
    return pinned or ver


def evaluate_manufacturing_gate(*, revision: DesignRevision) -> dict:
    payload = _geometry_payload_from_revision(revision)
    template_id = (payload.get('template_id') or '').strip()
    if not template_id:
        raise ExportJobError('template_id missing on revision', code='UNKNOWN_TEMPLATE', status=400)

    version = _resolve_template_version(revision, template_id)
    caps = version.capabilities if isinstance(version.capabilities, dict) else {}
    capability_ok = bool(caps.get('canExportManufacturing'))

    material_id = payload.get('material_id') or 'kraft'
    thickness_mm = payload.get('thickness_mm')
    approval = find_template_approval(version, material_id, thickness_mm)
    approval_ok = approval is not None

    try:
        validated = validate_geometry(payload)
    except GeometryServiceError as exc:
        raise ExportJobError(
            str(exc),
            code=exc.code or 'GEOMETRY_REJECTED',
            status=exc.status_code if exc.status_code >= 400 else 400,
            data={'geometry': exc.payload},
        ) from exc

    cut_approx = bool(validated.get('cut_approx'))
    bleed_approx = bool(validated.get('bleed_approx'))
    approx_ok = not cut_approx and not bleed_approx
    geometry_ok = bool(validated.get('ok'))
    # Parametric native-mm defaults trusted; adapters must send unit_confidence.
    if 'unit_trusted' in validated:
        unit_trusted = bool(validated.get('unit_trusted'))
    else:
        unit_trusted = str(validated.get('unit_confidence') or 'trusted') == 'trusted'

    sample = find_matching_sample_pass(
        template_key=template_id,
        material_id=material_id,
        length_mm=payload.get('length_mm'),
        width_mm=payload.get('width_mm'),
        height_mm=payload.get('height_mm'),
        thickness_mm=thickness_mm,
        organization_id=revision.design.organization_id,
    )
    sample_ok = sample is not None

    checks = [
        {
            'code': 'CAPABILITY',
            'ok': capability_ok,
            'detail': 'canExportManufacturing' if capability_ok else 'CAPABILITY_DISABLED',
        },
        {
            'code': 'APPROVAL',
            'ok': approval_ok,
            'detail': str(approval.id) if approval_ok else 'NO_APPROVAL',
        },
        {
            'code': 'SAMPLE',
            'ok': sample_ok,
            'detail': str(sample.id) if sample_ok else 'NO_SAMPLE_PASS',
        },
        {
            'code': 'GEOMETRY',
            'ok': geometry_ok,
            'detail': 'validated.ok' if geometry_ok else 'GEOMETRY_INVALID',
        },
        {
            'code': 'UNIT_TRUSTED',
            'ok': unit_trusted,
            'detail': validated.get('unit_confidence') or ('trusted' if unit_trusted else 'untrusted'),
        },
        {
            'code': 'APPROX',
            'ok': approx_ok,
            'detail': (
                'ok'
                if approx_ok
                else {
                    'cut_approx': cut_approx,
                    'bleed_approx': bleed_approx,
                    'cut_approx_reason': validated.get('cut_approx_reason'),
                }
            ),
        },
    ]
    ok = all(item['ok'] for item in checks)
    return {
        'ok': ok,
        'checks': checks,
        'approval_id': str(approval.id) if approval else None,
        'sample_test_id': str(sample.id) if sample else None,
        'template_version_id': str(version.id),
        'cut_approx': cut_approx,
        'bleed_approx': bleed_approx,
        'cut_approx_reason': validated.get('cut_approx_reason'),
        'license': dict(LICENSE_NOTE),
        'geometry_validate': {
            'ok': validated.get('ok'),
            'geometry_hash': validated.get('geometry_hash'),
            'production_ready': validated.get('production_ready'),
            'unit_confidence': validated.get('unit_confidence'),
            'unit_trusted': unit_trusted,
        },
    }


def evaluate_engineering_gate(*, revision: DesignRevision) -> dict:
    """Trusted dieline gate: GEOMETRY + UNIT + APPROX + DOMAIN (no CAPABILITY/APPROVAL)."""
    payload = _geometry_payload_from_revision(revision)
    template_id = (payload.get('template_id') or '').strip()
    if not template_id:
        raise ExportJobError('template_id missing on revision', code='UNKNOWN_TEMPLATE', status=400)

    domain = check_engineering_domain(payload)
    domain_ok = bool(domain.get('ok'))

    validate_payload = {**payload, 'quality_tier': 'engineering', 'intent': 'engineering'}
    try:
        validated = validate_geometry(validate_payload)
    except GeometryServiceError as exc:
        # Domain rejection from geometry service maps to DOMAIN check.
        if (exc.code or '') == 'OUT_OF_ENGINEERING_DOMAIN':
            domain = {
                'ok': False,
                'code': 'OUT_OF_ENGINEERING_DOMAIN',
                'detail': (exc.payload or {}).get('message') or str(exc),
            }
            domain_ok = False
            validated = {
                'ok': False,
                'cut_approx': False,
                'bleed_approx': False,
                'unit_trusted': True,
                'unit_confidence': 'trusted',
                'geometry_hash': None,
                'production_ready': False,
            }
        else:
            raise ExportJobError(
                str(exc),
                code=exc.code or 'GEOMETRY_REJECTED',
                status=exc.status_code if exc.status_code >= 400 else 400,
                data={'geometry': exc.payload},
            ) from exc

    cut_approx = bool(validated.get('cut_approx'))
    bleed_approx = bool(validated.get('bleed_approx'))
    approx_ok = not cut_approx and not bleed_approx
    geometry_ok = bool(validated.get('ok'))
    if 'unit_trusted' in validated:
        unit_trusted = bool(validated.get('unit_trusted'))
    else:
        unit_trusted = str(validated.get('unit_confidence') or 'trusted') == 'trusted'

    checks = [
        {
            'code': 'GEOMETRY',
            'ok': geometry_ok,
            'detail': 'validated.ok' if geometry_ok else 'GEOMETRY_INVALID',
        },
        {
            'code': 'UNIT_TRUSTED',
            'ok': unit_trusted,
            'detail': validated.get('unit_confidence') or ('trusted' if unit_trusted else 'untrusted'),
        },
        {
            'code': 'APPROX',
            'ok': approx_ok,
            'detail': (
                'ok'
                if approx_ok
                else {
                    'cut_approx': cut_approx,
                    'bleed_approx': bleed_approx,
                    'cut_approx_reason': validated.get('cut_approx_reason'),
                }
            ),
        },
        {
            'code': 'DOMAIN',
            'ok': domain_ok,
            'detail': domain.get('detail') if not domain_ok else domain.get('detail') or 'ok',
        },
    ]
    ok = all(item['ok'] for item in checks)
    return {
        'ok': ok,
        'checks': checks,
        'cut_approx': cut_approx,
        'bleed_approx': bleed_approx,
        'cut_approx_reason': validated.get('cut_approx_reason'),
        'license': dict(LICENSE_NOTE),
        'disclaimer': ENGINEERING_DISCLAIMER,
        'qualification_status': 'engineering_review',
        'geometry_validate': {
            'ok': validated.get('ok'),
            'geometry_hash': validated.get('geometry_hash'),
            'production_ready': validated.get('production_ready'),
            'unit_confidence': validated.get('unit_confidence'),
            'unit_trusted': unit_trusted,
            'engineering_domain_ok': domain_ok,
        },
    }


def create_export_job(
    *,
    design: Design,
    user,
    format: str,
    quality_tier: str,
    revision_id: str | None,
    options: dict | None,
    idempotency_key: str | None,
):
    if design.status != Design.Status.ACTIVE:
        raise ExportJobError('design archived', code='DESIGN_ARCHIVED', status=400)

    fmt = (format or '').strip().lower()
    tier = (quality_tier or '').strip().lower()
    opts = options if isinstance(options, dict) else {}

    if fmt not in (
        ExportJob.Format.SVG,
        ExportJob.Format.DXF,
        ExportJob.Format.PDF,
    ):
        raise ExportJobError('format must be svg|dxf|pdf', code='VALIDATION_ERROR', status=400)

    if tier not in (
        ExportJob.QualityTier.VECTOR_PROOF,
        ExportJob.QualityTier.ENGINEERING,
        ExportJob.QualityTier.MANUFACTURING,
    ):
        raise ExportJobError(
            'quality_tier must be vector_proof|engineering|manufacturing',
            code='VALIDATION_ERROR',
            status=400,
        )

    revision = _resolve_revision(design, revision_id)
    content = revision.content_json or {}
    geom = content.get('geometry') or {}
    if geom.get('mode') == 'model_only':
        raise ExportJobError('model_only designs cannot export dielines', code='MODEL_ONLY', status=400)

    gate_snapshot = None
    initial_preflight: dict = {}
    if tier == ExportJob.QualityTier.MANUFACTURING:
        gate_snapshot = evaluate_manufacturing_gate(revision=revision)
        if not gate_snapshot['ok']:
            failed = [c['code'] for c in gate_snapshot['checks'] if not c['ok']]
            raise ExportJobError(
                'manufacturing exports are blocked until manufacturing gate passes',
                code='MANUFACTURING_BLOCKED',
                status=422,
                errors={'failed_checks': failed},
                data={'checks': gate_snapshot['checks'], 'license': gate_snapshot['license']},
            )
        initial_preflight = {
            'gate': gate_snapshot,
            'license': gate_snapshot['license'],
            'manufacturing_ready': False,
            'approval_id': gate_snapshot.get('approval_id'),
        }
        opts = {**opts, 'manufacturing_gate': gate_snapshot}
    elif tier == ExportJob.QualityTier.ENGINEERING:
        gate_snapshot = evaluate_engineering_gate(revision=revision)
        if not gate_snapshot['ok']:
            failed = [c['code'] for c in gate_snapshot['checks'] if not c['ok']]
            raise ExportJobError(
                'engineering exports are blocked until engineering gate passes',
                code='ENGINEERING_BLOCKED',
                status=422,
                errors={'failed_checks': failed},
                data={'checks': gate_snapshot['checks'], 'license': gate_snapshot['license']},
            )
        initial_preflight = {
            'gate': gate_snapshot,
            'license': gate_snapshot['license'],
            'manufacturing_ready': False,
            'disclaimer': gate_snapshot.get('disclaimer') or ENGINEERING_DISCLAIMER,
            'qualification_status': gate_snapshot.get('qualification_status') or 'engineering_review',
        }
        opts = {**opts, 'engineering_gate': gate_snapshot}

    key = (idempotency_key or '').strip() or f'export-{uuid.uuid4()}'
    existing = ExportJob.objects.filter(organization_id=design.organization_id, idempotency_key=key).first()
    if existing:
        same = (
            existing.design_id == design.id
            and existing.format == fmt
            and existing.quality_tier == tier
            and str(existing.input_revision_id) == str(revision.id)
        )
        if not same:
            raise ExportJobError(
                'idempotency key reuse with different payload',
                code='IDEMPOTENCY_CONFLICT',
                status=409,
            )
        return serialize_job(existing), 200, True

    with transaction.atomic():
        job = ExportJob.objects.create(
            organization_id=design.organization_id,
            design=design,
            input_revision=revision,
            owner=user,
            format=fmt,
            quality_tier=tier,
            status=ExportJob.Status.QUEUED,
            idempotency_key=key,
            content_hash=revision.content_hash or '',
            geometry_hash=revision.geometry_hash or '',
            engine_version=revision.engine_version or '',
            exporter_version=EXPORTER_VERSION,
            options=opts,
            preflight=initial_preflight,
        )
        OutboxEvent.objects.create(
            event_type='export.job_queued',
            payload={'job_id': str(job.id), 'organization_id': str(design.organization_id)},
        )

    job_id = str(job.id)
    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        process_export_job(job_id)
        job.refresh_from_db()
        return serialize_job(job), 202, False

    from apps.exports.tasks import dispatch_queued_export

    transaction.on_commit(lambda: dispatch_queued_export.delay(job_id))
    return serialize_job(job), 202, False


def _fail_job(job_id: str, *, code: str, message: str) -> dict:
    with transaction.atomic():
        locked = ExportJob.objects.select_for_update().get(pk=job_id)
        if locked.status == ExportJob.Status.CANCELLED:
            return serialize_job(locked)
        locked.status = ExportJob.Status.FAILED
        locked.error_code = str(code)[:64]
        locked.error_message = str(message)[:2000]
        locked.finished_at = timezone.now()
        locked.save(update_fields=['status', 'error_code', 'error_message', 'finished_at', 'updated_at'])
        return serialize_job(locked)


def process_export_job(job_id: str) -> dict:
    with transaction.atomic():
        job = ExportJob.objects.select_for_update().select_related(
            'input_revision',
            'owner',
            'organization',
            'design',
        ).get(pk=job_id)
        if job.status == ExportJob.Status.SUCCEEDED and job.result_asset_id:
            return serialize_job(job)
        if job.status in (ExportJob.Status.CANCELLED, ExportJob.Status.FAILED):
            return serialize_job(job)
        job.status = ExportJob.Status.RUNNING
        job.save(update_fields=['status', 'updated_at'])

    gate_snapshot = {}
    if isinstance(job.options, dict):
        gate_snapshot = (
            job.options.get('manufacturing_gate')
            or job.options.get('engineering_gate')
            or {}
        )
    if not gate_snapshot and isinstance(job.preflight, dict):
        gate_snapshot = job.preflight.get('gate') or {}

    try:
        payload = _geometry_payload_from_revision(job.input_revision)
        payload['format'] = job.format
        payload['quality_tier'] = job.quality_tier
        if job.quality_tier == ExportJob.QualityTier.ENGINEERING:
            payload['intent'] = 'engineering'
        result = export_dieline(payload)
        raw_b64 = result.get('content_base64') or ''
        raw = base64.b64decode(raw_b64)
        mime = result.get('mime') or ''
        filename = result.get('filename') or f'export.{job.format}'
        geom_preflight = result.get('preflight') if isinstance(result.get('preflight'), dict) else {}
        cut_approx = bool(geom_preflight.get('cut_approx'))
        bleed_approx = bool(geom_preflight.get('bleed_approx'))
        if job.quality_tier in (
            ExportJob.QualityTier.MANUFACTURING,
            ExportJob.QualityTier.ENGINEERING,
        ) and (cut_approx or bleed_approx):
            return _fail_job(
                job_id,
                code='APPROX_BLOCKED',
                message=f'{job.quality_tier} export blocked: cutApprox/bleedApprox present',
            )
        asset = store_bytes(
            organization=job.organization,
            owner=job.owner,
            data=raw,
            mime=mime,
            filename=filename,
            source='export',
            meta={'export_job_id': str(job.id), 'format': job.format, 'quality_tier': job.quality_tier},
        )
    except (GeometryServiceError, AssetUploadError, ValueError, TypeError) as exc:
        code = getattr(exc, 'code', 'EXPORT_FAILED')
        serialized = _fail_job(job_id, code=str(code), message=str(exc))
        if isinstance(exc, GeometryServiceError):
            raise ExportJobError(str(exc), code=exc.code, status=exc.status_code) from exc
        raise ExportJobError(str(exc), code=str(code), status=400) from exc
    except Exception as exc:  # noqa: BLE001
        _fail_job(job_id, code='EXPORT_CRASH', message=str(exc))
        raise

    merged = {**(gate_snapshot or {}), **geom_preflight}
    if isinstance(gate_snapshot, dict) and gate_snapshot:
        merged['gate'] = gate_snapshot
        if gate_snapshot.get('approval_id'):
            merged['approval_id'] = gate_snapshot['approval_id']
    merged['license'] = dict(LICENSE_NOTE)
    if job.quality_tier == ExportJob.QualityTier.MANUFACTURING:
        gate_ok = bool(gate_snapshot.get('ok')) if isinstance(gate_snapshot, dict) else False
        merged['manufacturing_ready'] = gate_ok and not cut_approx and not bleed_approx
    else:
        merged['manufacturing_ready'] = False
    if job.quality_tier == ExportJob.QualityTier.ENGINEERING:
        merged['disclaimer'] = geom_preflight.get('disclaimer') or ENGINEERING_DISCLAIMER
        merged['qualification_status'] = 'engineering_review'

    with transaction.atomic():
        locked = ExportJob.objects.select_for_update().get(pk=job_id)
        if locked.status == ExportJob.Status.CANCELLED:
            return serialize_job(locked)
        if locked.status == ExportJob.Status.SUCCEEDED and locked.result_asset_id:
            return serialize_job(locked)
        locked.status = ExportJob.Status.SUCCEEDED
        locked.result_asset = asset
        locked.checksum = asset.sha256
        locked.preflight = merged
        locked.error_code = ''
        locked.error_message = ''
        locked.finished_at = timezone.now()
        locked.save(
            update_fields=[
                'status',
                'result_asset',
                'checksum',
                'preflight',
                'error_code',
                'error_message',
                'finished_at',
                'updated_at',
            ]
        )
        AssetReference.objects.get_or_create(
            asset=asset,
            ref_type='export_job',
            ref_id=str(locked.id),
        )
        OutboxEvent.objects.filter(
            event_type='export.job_queued',
            payload__job_id=str(locked.id),
            status=OutboxEvent.Status.PENDING,
        ).update(status=OutboxEvent.Status.SENT, sent_at=timezone.now())
        return serialize_job(locked)
