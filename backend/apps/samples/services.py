from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.utils import timezone

from apps.assets.services import AssetUploadError, store_sample_bytes
from apps.catalog.models import TemplateDefinition, TemplateVersion
from apps.designs.models import DesignRevision
from apps.samples.models import SampleTestRecord


class SampleServiceError(Exception):
    def __init__(self, message, code='SAMPLE_ERROR', status=400, errors=None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.errors = errors or {}


def _dec(value, field: str) -> Decimal:
    try:
        d = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise SampleServiceError(f'{field} must be a number', code='VALIDATION_ERROR') from exc
    if not d.is_finite():
        raise SampleServiceError(f'{field} must be finite', code='VALIDATION_ERROR')
    return d


def serialize_sample(record: SampleTestRecord) -> dict:
    return {
        'id': str(record.id),
        'organization_id': str(record.organization_id),
        'template_key': record.template_key,
        'template_version_id': str(record.template_version_id) if record.template_version_id else None,
        'design_revision_id': str(record.design_revision_id) if record.design_revision_id else None,
        'geometry_hash': record.geometry_hash,
        'length_mm': float(record.length_mm),
        'width_mm': float(record.width_mm),
        'height_mm': float(record.height_mm),
        'thickness_mm': float(record.thickness_mm),
        'material_id': record.material_id,
        'flute_direction': record.flute_direction,
        'size_mode': record.size_mode,
        'length_min_mm': float(record.length_min_mm) if record.length_min_mm is not None else None,
        'length_max_mm': float(record.length_max_mm) if record.length_max_mm is not None else None,
        'width_min_mm': float(record.width_min_mm) if record.width_min_mm is not None else None,
        'width_max_mm': float(record.width_max_mm) if record.width_max_mm is not None else None,
        'height_min_mm': float(record.height_min_mm) if record.height_min_mm is not None else None,
        'height_max_mm': float(record.height_max_mm) if record.height_max_mm is not None else None,
        'thickness_min_mm': float(record.thickness_min_mm) if record.thickness_min_mm is not None else None,
        'thickness_max_mm': float(record.thickness_max_mm) if record.thickness_max_mm is not None else None,
        'process_profile': record.process_profile,
        'equipment': record.equipment,
        'notes': record.notes,
        'measurements': record.measurements or {},
        'verdict': record.verdict,
        'reviewed_by_id': str(record.reviewed_by_id) if record.reviewed_by_id else None,
        'reviewed_at': record.reviewed_at.isoformat() if record.reviewed_at else None,
        'created_by_id': str(record.created_by_id),
        'evidence_asset_ids': [str(a.id) for a in record.evidence_assets.all()],
        'created_at': record.created_at.isoformat() if record.created_at else None,
        'updated_at': record.updated_at.isoformat() if record.updated_at else None,
    }


def create_sample_test(*, organization, user, body: dict) -> SampleTestRecord:
    template_key = str(body.get('template_key') or '').strip()
    if not template_key:
        raise SampleServiceError('template_key required', code='VALIDATION_ERROR')
    geometry_hash = str(body.get('geometry_hash') or '').strip()
    if not geometry_hash:
        raise SampleServiceError('geometry_hash required', code='VALIDATION_ERROR')

    tpl = TemplateDefinition.objects.filter(template_key=template_key).first()
    if not tpl:
        raise SampleServiceError('unknown template_key', code='UNKNOWN_TEMPLATE', status=404)

    tv = None
    tv_id = body.get('template_version_id')
    if tv_id:
        tv = TemplateVersion.objects.filter(pk=tv_id, template=tpl).first()
        if not tv:
            raise SampleServiceError('template version not found', code='NOT_FOUND', status=404)
    else:
        tv = tpl.versions.filter(is_current=True).first()

    revision = None
    rev_id = body.get('design_revision_id')
    if rev_id:
        revision = DesignRevision.objects.filter(pk=rev_id, design__organization=organization).first()
        if not revision:
            raise SampleServiceError('design revision not found', code='NOT_FOUND', status=404)

    length = _dec(body.get('length_mm'), 'length_mm')
    width = _dec(body.get('width_mm'), 'width_mm')
    height = _dec(body.get('height_mm'), 'height_mm')
    thickness = _dec(body.get('thickness_mm'), 'thickness_mm')
    material_id = str(body.get('material_id') or 'kraft').strip() or 'kraft'
    flute = str(body.get('flute_direction') or 'L').strip() or 'L'
    size_mode = str(body.get('size_mode') or 'inner').strip() or 'inner'
    if size_mode not in ('inner', 'outer'):
        raise SampleServiceError('size_mode must be inner|outer', code='VALIDATION_ERROR')

    record = SampleTestRecord.objects.create(
        organization=organization,
        template_key=template_key,
        template_version=tv,
        design_revision=revision,
        geometry_hash=geometry_hash,
        length_mm=length,
        width_mm=width,
        height_mm=height,
        thickness_mm=thickness,
        material_id=material_id,
        flute_direction=flute,
        size_mode=size_mode,
        process_profile=str(body.get('process_profile') or '')[:160],
        equipment=str(body.get('equipment') or '')[:160],
        notes=str(body.get('notes') or ''),
        measurements=body.get('measurements') if isinstance(body.get('measurements'), dict) else {},
        verdict=SampleTestRecord.Verdict.PENDING,
        created_by=user,
    )
    return record


def attach_evidence(*, record: SampleTestRecord, organization, owner, uploaded_file) -> SampleTestRecord:
    if record.organization_id != organization.id:
        raise SampleServiceError('organization mismatch', code='FORBIDDEN', status=403)
    data = uploaded_file.read()
    mime = (getattr(uploaded_file, 'content_type', None) or '').strip().lower()
    filename = getattr(uploaded_file, 'name', None) or 'evidence.bin'
    try:
        asset = store_sample_bytes(
            organization=organization,
            owner=owner,
            data=data,
            mime=mime,
            filename=filename,
            meta={'sample_test_id': str(record.id)},
        )
    except AssetUploadError as exc:
        raise SampleServiceError(str(exc), code=exc.code, status=400) from exc
    record.evidence_assets.add(asset)
    return record


def review_sample(*, record: SampleTestRecord, reviewer, verdict: str, notes: str | None = None) -> SampleTestRecord:
    v = (verdict or '').strip().lower()
    if v not in (SampleTestRecord.Verdict.PASS, SampleTestRecord.Verdict.FAIL):
        raise SampleServiceError('verdict must be pass|fail', code='VALIDATION_ERROR')
    if record.verdict != SampleTestRecord.Verdict.PENDING:
        raise SampleServiceError('sample already reviewed', code='ALREADY_REVIEWED', status=409)

    record.verdict = v
    record.reviewed_by = reviewer
    record.reviewed_at = timezone.now()
    if notes is not None:
        record.notes = str(notes)

    if v == SampleTestRecord.Verdict.PASS:
        # Exact-size narrow domain when ranges omitted (±0).
        if record.length_min_mm is None:
            record.length_min_mm = record.length_mm
        if record.length_max_mm is None:
            record.length_max_mm = record.length_mm
        if record.width_min_mm is None:
            record.width_min_mm = record.width_mm
        if record.width_max_mm is None:
            record.width_max_mm = record.width_mm
        if record.height_min_mm is None:
            record.height_min_mm = record.height_mm
        if record.height_max_mm is None:
            record.height_max_mm = record.height_mm
        if record.thickness_min_mm is None:
            record.thickness_min_mm = record.thickness_mm
        if record.thickness_max_mm is None:
            record.thickness_max_mm = record.thickness_mm

    record.save()
    return record


def _in_range(value, lo, hi) -> bool:
    if value is None or lo is None or hi is None:
        return False
    try:
        v = Decimal(str(value))
        a = Decimal(str(lo))
        b = Decimal(str(hi))
    except (InvalidOperation, TypeError, ValueError):
        return False
    return a <= v <= b


def find_matching_sample_pass(
    *,
    template_key: str,
    material_id: str,
    length_mm,
    width_mm,
    height_mm,
    thickness_mm,
    organization_id=None,
) -> SampleTestRecord | None:
    """Find a pass record whose narrow domain covers the revision dims (hash not required)."""
    qs = SampleTestRecord.objects.filter(
        template_key=template_key,
        verdict=SampleTestRecord.Verdict.PASS,
        material_id=material_id,
    )
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    qs = qs.filter(
        length_min_mm__isnull=False,
        length_max_mm__isnull=False,
        width_min_mm__isnull=False,
        width_max_mm__isnull=False,
        height_min_mm__isnull=False,
        height_max_mm__isnull=False,
        thickness_min_mm__isnull=False,
        thickness_max_mm__isnull=False,
    )
    for rec in qs.order_by('-reviewed_at', '-created_at'):
        if (
            _in_range(length_mm, rec.length_min_mm, rec.length_max_mm)
            and _in_range(width_mm, rec.width_min_mm, rec.width_max_mm)
            and _in_range(height_mm, rec.height_min_mm, rec.height_max_mm)
            and _in_range(thickness_mm, rec.thickness_min_mm, rec.thickness_max_mm)
        ):
            return rec
    return None
