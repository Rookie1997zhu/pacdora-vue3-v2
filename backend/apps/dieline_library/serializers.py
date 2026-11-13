from __future__ import annotations

from django.utils import timezone

from apps.dieline_library.models import (
    AcquisitionItem,
    AcquisitionJob,
    AcquisitionPlan,
    AssetVariant,
    ImmutableRevision,
    UsageGrant,
)


def _list_preview_revision(variant: AssetVariant) -> ImmutableRevision | None:
    """Pick a revision safe to thumbnail on the authenticated library list."""
    revs = (
        variant.revisions.select_related('usage_grant')
        .filter(
            preview_asset_id__isnull=False,
            acquisition_status=ImmutableRevision.AcquisitionStatus.OK,
        )
        .order_by('-revision_no')
    )
    now = timezone.now()
    for rev in revs:
        grant = getattr(rev, 'usage_grant', None)
        if not grant:
            continue
        if grant.valid_until and grant.valid_until < now:
            continue
        if grant.can_show_public_preview or grant.can_use_internally or grant.can_redistribute_files:
            return rev
    return None


def grant_payload(grant: UsageGrant | None) -> dict | None:
    if not grant:
        return None
    return {
        'can_store': grant.can_store,
        'can_transform': grant.can_transform,
        'can_use_internally': grant.can_use_internally,
        'can_use_commercially': grant.can_use_commercially,
        'can_show_public_preview': grant.can_show_public_preview,
        'can_redistribute_files': grant.can_redistribute_files,
        'valid_until': grant.valid_until.isoformat() if grant.valid_until else None,
        'attribution': grant.attribution,
    }


def revision_payload(rev: ImmutableRevision, *, include_grant: bool = True) -> dict:
    data = {
        'id': str(rev.id),
        'revision_no': rev.revision_no,
        'format': rev.format,
        'sha256': rev.sha256,
        'original_filename': rev.original_filename,
        'captured_at': rev.captured_at.isoformat() if rev.captured_at else None,
        'acquisition_status': rev.acquisition_status,
        'rights_status': rev.rights_status,
        'manufacturing_status': rev.manufacturing_status,
        'publication_status': rev.publication_status,
        'asset_id': str(rev.asset_id),
        'preview_asset_id': str(rev.preview_asset_id) if rev.preview_asset_id else None,
        'has_preview': bool(rev.preview_asset_id) and rev.acquisition_status == ImmutableRevision.AcquisitionStatus.OK,
    }
    if include_grant:
        grant = getattr(rev, 'usage_grant', None)
        data['usage_grant'] = grant_payload(grant)
    return data


def variant_payload(variant: AssetVariant, *, with_revisions: bool = False) -> dict:
    family = variant.family if variant.family_id else None
    formats = list(
        variant.revisions.order_by('format').values_list('format', flat=True).distinct()
    )
    data = {
        'id': str(variant.id),
        'title_zh': variant.title_zh,
        'title_ko': variant.title_ko,
        'family_id': str(variant.family_id) if variant.family_id else None,
        'family_name_zh': family.name_zh if family else None,
        'family_name_ko': family.name_ko if family else None,
        'family_category': family.category if family else None,
        'formats': formats,
        'length_mm': str(variant.length_mm) if variant.length_mm is not None else None,
        'width_mm': str(variant.width_mm) if variant.width_mm is not None else None,
        'height_mm': str(variant.height_mm) if variant.height_mm is not None else None,
        'dimension_basis': variant.dimension_basis,
        'material_name': variant.material_name,
        'thickness_mm': str(variant.thickness_mm) if variant.thickness_mm is not None else None,
        'is_example': variant.is_example,
        'created_at': variant.created_at.isoformat() if variant.created_at else None,
    }
    preview_rev = _list_preview_revision(variant)
    data['preview_revision_id'] = str(preview_rev.id) if preview_rev else None
    data['has_preview'] = bool(preview_rev)
    if with_revisions:
        revs = list(variant.revisions.select_related('usage_grant').order_by('-revision_no'))
        data['revisions'] = [revision_payload(r) for r in revs]
        current = revs[0] if revs else None
        data['current_revision'] = revision_payload(current) if current else None
    return data


def plan_payload(plan: AcquisitionPlan) -> dict:
    return {
        'id': str(plan.id),
        'adapter_type': plan.adapter_type,
        'title': plan.title,
        'enabled': plan.enabled,
        'status': plan.status,
        'organization_id': str(plan.organization_id),
        'source_provider_id': str(plan.source_provider_id) if plan.source_provider_id else None,
        'policy_json': plan.policy_json or {},
        'spec_plan_json': plan.spec_plan_json or [],
        'budget_json': plan.budget_json or {},
        'created_at': plan.created_at.isoformat() if plan.created_at else None,
    }


def item_payload(item: AcquisitionItem) -> dict:
    return {
        'id': str(item.id),
        'external_key': item.external_key,
        'status': item.status,
        'failure_reason': item.failure_reason,
        'failure_code': item.failure_code,
        'attempt_count': item.attempt_count,
        'revision_id': str(item.revision_id) if item.revision_id else None,
        'spec_json': item.spec_json or {},
    }


def job_payload(job: AcquisitionJob, *, with_items: bool = False) -> dict:
    data = {
        'id': str(job.id),
        'plan_id': str(job.plan_id),
        'organization_id': str(job.organization_id),
        'status': job.status,
        'dry_run': job.dry_run,
        'cursor_json': job.cursor_json or {},
        'stats_json': job.stats_json or {},
        'last_error': job.last_error,
        'last_error_code': job.last_error_code,
        'idempotency_key': job.idempotency_key,
        'started_at': job.started_at.isoformat() if job.started_at else None,
        'finished_at': job.finished_at.isoformat() if job.finished_at else None,
        'created_at': job.created_at.isoformat() if job.created_at else None,
        'adapter_type': job.plan.adapter_type if job.plan_id else None,
    }
    if with_items:
        data['items'] = [item_payload(i) for i in job.items.order_by('created_at')[:500]]
    return data
