from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db.models import OuterRef, Q, Subquery
from django.http import FileResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.assets.services import absolute_path
from apps.dieline_library.models import AcquisitionJob, AcquisitionPlan, AssetVariant, ImmutableRevision
from apps.dieline_library.serializers import job_payload, plan_payload, revision_payload, variant_payload
from apps.dieline_library.services.adapters.base import AdapterError
from apps.dieline_library.services.adapters.runner import create_job, dry_run_plan, enqueue_job, validate_plan
from apps.organizations.permissions import org_ids_for, primary_org, require_org_membership
from config.api import fail, ok


def _variant_qs_for(user):
    return AssetVariant.objects.filter(organization_id__in=org_ids_for(user)).select_related('family')


def _parse_decimal(raw: str | None) -> Decimal | None:
    if raw is None or raw == '':
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None


def _apply_list_filters(qs, params):
    q = (params.get('q') or '').strip()
    if q:
        qs = qs.filter(
            Q(title_zh__icontains=q)
            | Q(title_ko__icontains=q)
            | Q(family__name_zh__icontains=q)
            | Q(family__name_ko__icontains=q)
        )

    category = (params.get('category') or '').strip()
    if category:
        qs = qs.filter(family__category=category)

    # Prefer file_format — DRF reserves query param `format` for content negotiation.
    fmt = (params.get('file_format') or '').strip().lower()
    if fmt:
        qs = qs.filter(revisions__format=fmt).distinct()

    for axis, field in (
        ('min_l', 'length_mm__gte'),
        ('max_l', 'length_mm__lte'),
        ('min_w', 'width_mm__gte'),
        ('max_w', 'width_mm__lte'),
        ('min_h', 'height_mm__gte'),
        ('max_h', 'height_mm__lte'),
    ):
        value = _parse_decimal(params.get(axis))
        if value is not None:
            qs = qs.filter(**{field: value})

    latest_rev_id = (
        ImmutableRevision.objects.filter(variant_id=OuterRef('pk'))
        .order_by('-revision_no')
        .values('id')[:1]
    )
    qs = qs.annotate(_latest_rev_id=Subquery(latest_rev_id))

    for status_key, rev_field in (
        ('rights_status', 'rights_status'),
        ('acquisition_status', 'acquisition_status'),
        ('manufacturing_status', 'manufacturing_status'),
    ):
        status_val = (params.get(status_key) or '').strip()
        if status_val:
            matching_ids = ImmutableRevision.objects.filter(
                id__in=qs.values('_latest_rev_id'),
                **{rev_field: status_val},
            ).values_list('variant_id', flat=True)
            qs = qs.filter(id__in=matching_ids)

    return qs


def _can_download(rev: ImmutableRevision) -> bool:
    grant = getattr(rev, 'usage_grant', None)
    if not grant:
        return False
    if grant.valid_until and grant.valid_until < timezone.now():
        return False
    if rev.publication_status == ImmutableRevision.PublicationStatus.REVOKED:
        return False
    return bool(grant.can_redistribute_files or grant.can_use_internally)


def _can_preview(rev: ImmutableRevision) -> bool:
    grant = getattr(rev, 'usage_grant', None)
    if not grant:
        return False
    if grant.valid_until and grant.valid_until < timezone.now():
        return False
    if rev.acquisition_status != ImmutableRevision.AcquisitionStatus.OK:
        return False
    if not rev.preview_asset_id:
        return False
    return bool(grant.can_show_public_preview or grant.can_use_internally or grant.can_redistribute_files)


class VariantListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _variant_qs_for(request.user).filter(is_example=False)
        include_examples = request.query_params.get('include_examples') == '1'
        if include_examples:
            qs = _variant_qs_for(request.user)
        # Default list: published revisions exist
        published_ids = (
            ImmutableRevision.objects.filter(
                variant_id__in=qs.values_list('id', flat=True),
                publication_status=ImmutableRevision.PublicationStatus.PUBLISHED,
            )
            .values_list('variant_id', flat=True)
            .distinct()
        )
        show_all = request.query_params.get('all') == '1'
        if not show_all:
            qs = qs.filter(id__in=published_ids)
        qs = _apply_list_filters(qs, request.query_params)
        items = [variant_payload(v, with_revisions=False) for v in qs.order_by('-created_at')[:100]]
        inventory_count = AssetVariant.objects.filter(
            organization_id__in=org_ids_for(request.user),
            is_example=False,
        ).count()
        return ok({'items': items, 'inventory_count': inventory_count}, request=request)


class VariantDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, variant_id):
        variant = _variant_qs_for(request.user).filter(id=variant_id).first()
        if not variant:
            return fail('无权访问或资源不存在', code='FORBIDDEN', request=request, http_status=403)
        return ok(variant_payload(variant, with_revisions=True), request=request)


class RevisionDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, revision_id):
        rev = (
            ImmutableRevision.objects.select_related('variant', 'asset', 'usage_grant')
            .filter(id=revision_id)
            .first()
        )
        if not rev or not require_org_membership(request.user, rev.variant.organization_id):
            return fail('无权访问修订', code='FORBIDDEN', request=request, http_status=403)
        if not _can_download(rev):
            return fail('无下载授权', code='DOWNLOAD_DENIED', request=request, http_status=403)
        path = absolute_path(rev.asset)
        if not path.exists():
            return fail('文件缺失', code='ASSET_MISSING', request=request, http_status=404)
        handle = path.open('rb')
        return FileResponse(
            handle,
            content_type=rev.asset.mime,
            as_attachment=True,
            filename=rev.original_filename or path.name,
        )


class RevisionPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, revision_id):
        rev = (
            ImmutableRevision.objects.select_related('variant', 'preview_asset', 'usage_grant')
            .filter(id=revision_id)
            .first()
        )
        if not rev or not require_org_membership(request.user, rev.variant.organization_id):
            return fail('无权访问修订', code='FORBIDDEN', request=request, http_status=403)
        if not _can_preview(rev):
            return fail('预览不可用', code='PREVIEW_UNAVAILABLE', request=request, http_status=404)
        path = absolute_path(rev.preview_asset)
        if not path.exists():
            return fail('预览文件缺失', code='PREVIEW_MISSING', request=request, http_status=404)
        handle = path.open('rb')
        # Attachment-style delivery; clients must not v-html raw originals.
        return FileResponse(
            handle,
            content_type=rev.preview_asset.mime or 'image/svg+xml',
            as_attachment=True,
            filename=f'preview-{rev.id}.svg',
        )


def _resolve_org(request, org_id=None):
    if org_id:
        if not require_org_membership(request.user, org_id):
            return None
        from apps.organizations.models import Organization

        return Organization.objects.filter(id=org_id).first()
    return primary_org(request.user)


class AcquisitionPlanValidateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        org = _resolve_org(request, body.get('organization_id'))
        if not org:
            return fail('无权访问组织', code='FORBIDDEN', request=request, http_status=403)

        plan_id = body.get('plan_id')
        if plan_id:
            plan = AcquisitionPlan.objects.filter(id=plan_id, organization=org).first()
            if not plan:
                return fail('计划不存在', code='PLAN_MISSING', request=request, http_status=404)
        else:
            adapter_type = str(body.get('adapter_type') or '').strip()
            if adapter_type not in {c.value for c in AcquisitionPlan.AdapterType}:
                return fail('无效 adapter_type', code='BAD_ADAPTER', request=request, http_status=400)
            plan = AcquisitionPlan(
                organization=org,
                adapter_type=adapter_type,
                enabled=bool(body.get('enabled', True)),
                policy_json=body.get('policy_json') or {},
                spec_plan_json=body.get('spec_plan_json') or [],
                budget_json=body.get('budget_json') or {},
                title=str(body.get('title') or ''),
            )

        try:
            validation = validate_plan(plan, owner=request.user)
            dry = dry_run_plan(plan, owner=request.user)
        except AdapterError as exc:
            return fail(str(exc), code=exc.code, request=request, http_status=400)

        return ok(
            {
                'validation': validation.to_dict(),
                'dry_run': dry.to_dict(),
                'plan': plan_payload(plan) if plan.id else {
                    'adapter_type': plan.adapter_type,
                    'enabled': plan.enabled,
                    'policy_json': plan.policy_json,
                    'spec_plan_json': plan.spec_plan_json,
                    'budget_json': plan.budget_json,
                },
            },
            request=request,
        )


class AcquisitionJobCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        org = _resolve_org(request, body.get('organization_id'))
        if not org:
            return fail('无权访问组织', code='FORBIDDEN', request=request, http_status=403)

        plan_id = body.get('plan_id')
        if plan_id:
            plan = AcquisitionPlan.objects.filter(id=plan_id, organization=org).first()
            if not plan:
                return fail('计划不存在', code='PLAN_MISSING', request=request, http_status=404)
        else:
            adapter_type = str(body.get('adapter_type') or '').strip()
            if adapter_type not in {c.value for c in AcquisitionPlan.AdapterType}:
                return fail('无效 adapter_type', code='BAD_ADAPTER', request=request, http_status=400)
            plan = AcquisitionPlan.objects.create(
                organization=org,
                adapter_type=adapter_type,
                enabled=bool(body.get('enabled', True)),
                status=AcquisitionPlan.Status.READY,
                policy_json=body.get('policy_json') or {},
                spec_plan_json=body.get('spec_plan_json') or [],
                budget_json=body.get('budget_json') or {},
                title=str(body.get('title') or adapter_type),
            )

        dry_run = bool(body.get('dry_run', True))
        idem = body.get('idempotency_key') or request.headers.get('Idempotency-Key')
        job = create_job(plan=plan, owner=request.user, dry_run=dry_run, idempotency_key=idem)
        sync = bool(body.get('sync')) or str(body.get('sync') or '') == '1'
        if sync:
            from apps.dieline_library.services.adapters.runner import process_job

            process_job(str(job.id))
            job.refresh_from_db()
        else:
            enqueue_job(job)
        return ok(job_payload(job, with_items=sync), request=request)


class AcquisitionJobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = (
            AcquisitionJob.objects.select_related('plan')
            .filter(id=job_id, organization_id__in=org_ids_for(request.user))
            .first()
        )
        if not job:
            return fail('无权访问或任务不存在', code='FORBIDDEN', request=request, http_status=403)
        return ok(job_payload(job, with_items=True), request=request)
