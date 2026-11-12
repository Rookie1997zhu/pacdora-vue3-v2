from __future__ import annotations

from datetime import timedelta

import requests
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.ai_jobs.config_store import (
    encrypt_api_key,
    get_or_create_config,
    resolved_settings,
    serialize_config_public,
)
from apps.ai_jobs.models import AiJob, UsageLedger
from apps.assets.models import Asset
from apps.assets.tasks import generate_thumbnail
from apps.catalog.models import Product, TemplateApproval, TemplateVersion
from apps.console.audit import write_audit
from apps.console.models import ConsoleAuditLog
from apps.console.pagination import paginate_queryset
from apps.console.permissions import IsStaffUser
from apps.designs.models import Design
from apps.dieline_library.models import AcquisitionJob, AssetVariant, ImmutableRevision, UsageGrant
from apps.dieline_library.tasks import dispatch_acquisition_job
from apps.exports.models import ExportJob
from apps.exports.tasks import dispatch_queued_export
from apps.orders.models import Order
from apps.orders.services import OrderServiceError, apply_manual_quote, cancel_order, confirm_order, serialize_order
from apps.organizations.models import Membership, Organization
from apps.quotes.models import Quote
from config.api import fail, ok

User = get_user_model()
STAFF = [IsAuthenticated, IsStaffUser]


def _q_search(qs, request, fields):
    q = (request.query_params.get('q') or '').strip()
    if not q:
        return qs
    clause = Q()
    for f in fields:
        clause |= Q(**{f'{f}__icontains': q})
    return qs.filter(clause)


class OverviewView(APIView):
    permission_classes = STAFF

    def get(self, request):
        since = timezone.now() - timedelta(days=1)
        geom_ok = False
        geom_detail = ''
        try:
            from django.conf import settings

            url = f'{settings.GEOMETRY_URL}/health'
            resp = requests.get(url, timeout=3)
            geom_ok = resp.status_code == 200
            geom_detail = resp.text[:200]
        except Exception as exc:  # noqa: BLE001
            geom_detail = str(exc)

        data = {
            'since': since.isoformat(),
            'counts': {
                'designs_24h': Design.objects.filter(created_at__gte=since).count(),
                'exports_24h': ExportJob.objects.filter(created_at__gte=since).count(),
                'orders_24h': Order.objects.filter(created_at__gte=since).count(),
                'quotes_24h': Quote.objects.filter(created_at__gte=since).count(),
                'export_failed': ExportJob.objects.filter(status=ExportJob.Status.FAILED).count(),
                'ai_failed': AiJob.objects.filter(status=AiJob.Status.FAILED).count(),
                'acquisition_failed': AcquisitionJob.objects.filter(status=AcquisitionJob.Status.FAILED).count(),
            },
            'health': {
                'geometry': {'ok': geom_ok, 'detail': geom_detail},
            },
        }
        return ok(data, request=request)


class UserListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = User.objects.all().order_by('-date_joined')
        qs = _q_search(qs, request, ['email', 'display_name'])
        staff = request.query_params.get('is_staff')
        if staff in ('0', '1', 'true', 'false'):
            qs = qs.filter(is_staff=staff in ('1', 'true'))
        active = request.query_params.get('is_active')
        if active in ('0', '1', 'true', 'false'):
            qs = qs.filter(is_active=active in ('1', 'true'))
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(u.id),
                'email': u.email,
                'display_name': u.display_name,
                'is_active': u.is_active,
                'is_staff': u.is_staff,
                'is_superuser': u.is_superuser,
                'date_joined': u.date_joined.isoformat(),
            }
            for u in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class UserPatchView(APIView):
    permission_classes = STAFF

    def patch(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if not user:
            return fail('user not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        fields = []
        if 'is_active' in body:
            user.is_active = bool(body['is_active'])
            fields.append('is_active')
        if 'is_staff' in body:
            user.is_staff = bool(body['is_staff'])
            fields.append('is_staff')
        if 'display_name' in body:
            user.display_name = str(body.get('display_name') or '')[:120]
            fields.append('display_name')
        if not fields:
            return fail('no fields', code='VALIDATION_ERROR', request=request)
        user.save(update_fields=fields)
        write_audit(
            request=request,
            action='user.patch',
            target_type='user',
            target_id=str(user.id),
            meta={k: getattr(user, k) for k in fields},
        )
        return ok(
            {
                'id': str(user.id),
                'email': user.email,
                'display_name': user.display_name,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
            },
            request=request,
        )


class OrgListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = Organization.objects.annotate(member_count=Count('memberships')).order_by('-created_at')
        qs = _q_search(qs, request, ['name', 'slug'])
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(o.id),
                'name': o.name,
                'slug': o.slug,
                'member_count': o.member_count,
                'created_at': o.created_at.isoformat(),
            }
            for o in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class OrgMembersView(APIView):
    permission_classes = STAFF

    def get(self, request, org_id):
        org = Organization.objects.filter(pk=org_id).first()
        if not org:
            return fail('org not found', code='NOT_FOUND', request=request, http_status=404)
        qs = Membership.objects.filter(organization=org).select_related('user').order_by('created_at')
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(m.id),
                'user_id': str(m.user_id),
                'email': m.user.email,
                'display_name': m.user.display_name,
                'role': m.role,
                'is_active': m.is_active,
            }
            for m in items
        ]
        return ok({'organization': {'id': str(org.id), 'name': org.name}, 'items': data, 'page': page}, request=request)

    def patch(self, request, org_id):
        org = Organization.objects.filter(pk=org_id).first()
        if not org:
            return fail('org not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        mid = body.get('membership_id')
        m = Membership.objects.filter(organization=org, pk=mid).first()
        if not m:
            return fail('membership not found', code='NOT_FOUND', request=request, http_status=404)
        fields = []
        if 'role' in body:
            role = str(body.get('role') or '')
            if role not in Membership.Role.values:
                return fail('invalid role', code='VALIDATION_ERROR', request=request)
            m.role = role
            fields.append('role')
        if 'is_active' in body:
            m.is_active = bool(body['is_active'])
            fields.append('is_active')
        if not fields:
            return fail('no fields', code='VALIDATION_ERROR', request=request)
        m.save(update_fields=fields)
        write_audit(
            request=request,
            action='org.membership.patch',
            target_type='membership',
            target_id=str(m.id),
            meta={'fields': fields, 'role': m.role, 'is_active': m.is_active},
        )
        return ok({'id': str(m.id), 'role': m.role, 'is_active': m.is_active}, request=request)


class ProductListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = Product.objects.select_related('default_template', 'default_template_version').order_by(
            'sort_order', 'slug'
        )
        status = (request.query_params.get('status') or '').strip()
        if status:
            qs = qs.filter(status=status)
        qs = _q_search(qs, request, ['slug', 'name', 'category'])
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(p.id),
                'slug': p.slug,
                'name': p.name,
                'category': p.category,
                'status': p.status,
                'sort_order': p.sort_order,
                'template_key': p.default_template.template_key if p.default_template_id else None,
                'updated_at': p.updated_at.isoformat(),
            }
            for p in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class ProductPatchView(APIView):
    permission_classes = STAFF

    def patch(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            return fail('product not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        fields = []
        if 'status' in body:
            st = str(body.get('status') or '')
            if st not in Product.Status.values:
                return fail('invalid status', code='VALIDATION_ERROR', request=request)
            product.status = st
            fields.append('status')
        if 'sort_order' in body:
            try:
                product.sort_order = int(body['sort_order'])
            except (TypeError, ValueError):
                return fail('invalid sort_order', code='VALIDATION_ERROR', request=request)
            fields.append('sort_order')
        if 'name' in body:
            product.name = str(body.get('name') or '')[:200]
            fields.append('name')
        if not fields:
            return fail('no fields', code='VALIDATION_ERROR', request=request)
        product.save(update_fields=fields + ['updated_at'])
        write_audit(
            request=request,
            action='catalog.product.patch',
            target_type='product',
            target_id=str(product.id),
            meta={k: getattr(product, k) for k in fields},
        )
        return ok({'id': str(product.id), 'status': product.status, 'sort_order': product.sort_order}, request=request)


class TemplateApprovalListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = TemplateApproval.objects.select_related('template_version__template').order_by('-created_at')
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(a.id),
                'template_key': a.template_version.template.template_key,
                'version': a.template_version.version,
                'approved': a.approved,
                'material_ids': a.material_ids,
                'notes': a.notes,
            }
            for a in items
        ]
        return ok({'items': data, 'page': page}, request=request)

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        tv = TemplateVersion.objects.filter(pk=body.get('template_version_id')).first()
        if not tv:
            return fail('template version not found', code='NOT_FOUND', request=request, http_status=404)
        a = TemplateApproval.objects.create(
            template_version=tv,
            material_ids=body.get('material_ids') or [],
            notes=str(body.get('notes') or ''),
            approved=bool(body.get('approved')),
            approved_at=timezone.now() if body.get('approved') else None,
        )
        write_audit(
            request=request,
            action='catalog.approval.create',
            target_type='template_approval',
            target_id=str(a.id),
        )
        return ok({'id': str(a.id), 'approved': a.approved}, request=request, http_status=201)


class TemplateApprovalPatchView(APIView):
    permission_classes = STAFF

    def patch(self, request, approval_id):
        a = TemplateApproval.objects.filter(pk=approval_id).first()
        if not a:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        if 'approved' in body:
            a.approved = bool(body['approved'])
            a.approved_at = timezone.now() if a.approved else None
        if 'notes' in body:
            a.notes = str(body.get('notes') or '')
        if 'material_ids' in body and isinstance(body['material_ids'], list):
            a.material_ids = body['material_ids']
        a.save()
        write_audit(
            request=request,
            action='catalog.approval.patch',
            target_type='template_approval',
            target_id=str(a.id),
            meta={'approved': a.approved},
        )
        return ok({'id': str(a.id), 'approved': a.approved}, request=request)


class DesignListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = Design.objects.select_related('organization', 'owner', 'product', 'current_revision').order_by(
            '-updated_at'
        )
        org = request.query_params.get('organization_id')
        if org:
            qs = qs.filter(organization_id=org)
        status = (request.query_params.get('status') or '').strip()
        if status:
            qs = qs.filter(status=status)
        qs = _q_search(qs, request, ['name'])
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(d.id),
                'name': d.name,
                'status': d.status,
                'organization_id': str(d.organization_id),
                'organization_name': d.organization.name if d.organization_id else None,
                'owner_email': d.owner.email if d.owner_id else None,
                'product_slug': d.product.slug if d.product_id else None,
                'row_version': d.row_version,
                'geometry_hash': d.current_revision.geometry_hash if d.current_revision_id else None,
                'updated_at': d.updated_at.isoformat(),
            }
            for d in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class ExportListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = ExportJob.objects.select_related('organization', 'design', 'owner').order_by('-created_at')
        status = (request.query_params.get('status') or '').strip()
        if status:
            qs = qs.filter(status=status)
        fmt = (request.query_params.get('format') or '').strip()
        if fmt:
            qs = qs.filter(format=fmt)
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(j.id),
                'format': j.format,
                'quality_tier': j.quality_tier,
                'status': j.status,
                'error_code': j.error_code,
                'error_message': j.error_message,
                'design_id': str(j.design_id),
                'design_name': j.design.name if j.design_id else None,
                'organization_id': str(j.organization_id),
                'created_at': j.created_at.isoformat(),
                'finished_at': j.finished_at.isoformat() if j.finished_at else None,
            }
            for j in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class ExportRetryView(APIView):
    permission_classes = STAFF

    def post(self, request, job_id):
        job = ExportJob.objects.filter(pk=job_id).first()
        if not job:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        if job.status not in (ExportJob.Status.FAILED, ExportJob.Status.CANCELLED):
            return fail('only failed/cancelled jobs can retry', code='INVALID_STATUS', request=request)
        job.status = ExportJob.Status.QUEUED
        job.error_code = ''
        job.error_message = ''
        job.finished_at = None
        job.save(update_fields=['status', 'error_code', 'error_message', 'finished_at', 'updated_at'])
        dispatch_queued_export.delay(str(job.id))
        write_audit(request=request, action='export.retry', target_type='export_job', target_id=str(job.id))
        return ok({'id': str(job.id), 'status': job.status}, request=request)


class ExportCancelView(APIView):
    permission_classes = STAFF

    def post(self, request, job_id):
        job = ExportJob.objects.filter(pk=job_id).first()
        if not job:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        if job.status in (ExportJob.Status.SUCCEEDED, ExportJob.Status.CANCELLED):
            return fail('cannot cancel', code='INVALID_STATUS', request=request)
        job.status = ExportJob.Status.CANCELLED
        job.finished_at = timezone.now()
        job.save(update_fields=['status', 'finished_at', 'updated_at'])
        write_audit(request=request, action='export.cancel', target_type='export_job', target_id=str(job.id))
        return ok({'id': str(job.id), 'status': job.status}, request=request)


class OrderListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = Order.objects.select_related('organization', 'created_by').order_by('-created_at')
        status = (request.query_params.get('status') or '').strip()
        if status:
            qs = qs.filter(status=status)
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(o.id),
                'status': o.status,
                'organization_id': str(o.organization_id),
                'organization_name': o.organization.name,
                'row_version': o.row_version,
                'currency': o.currency,
                'total_amount': str(o.total_amount) if o.total_amount is not None else None,
                'created_at': o.created_at.isoformat(),
            }
            for o in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class OrderManualQuoteView(APIView):
    permission_classes = STAFF

    def post(self, request, order_id):
        order = Order.objects.select_related('organization').filter(pk=order_id).first()
        if not order:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        try:
            expected = int(body.get('expected_row_version'))
        except (TypeError, ValueError):
            return fail('expected_row_version required', code='VALIDATION_ERROR', request=request)
        try:
            updated = apply_manual_quote(
                organization=order.organization,
                user=request.user,
                order_id=order.id,
                expected_row_version=expected,
                lines=body.get('lines') or [],
            )
        except OrderServiceError as exc:
            return fail(str(exc), code=exc.code, errors=exc.errors, request=request, http_status=exc.status)
        write_audit(request=request, action='order.manual_quote', target_type='order', target_id=str(order.id))
        return ok(serialize_order(updated), request=request)


class OrderConfirmView(APIView):
    permission_classes = STAFF

    def post(self, request, order_id):
        order = Order.objects.select_related('organization').filter(pk=order_id).first()
        if not order:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        try:
            expected = int(body.get('expected_row_version'))
        except (TypeError, ValueError):
            return fail('expected_row_version required', code='VALIDATION_ERROR', request=request)
        try:
            updated = confirm_order(
                organization=order.organization, order_id=order.id, expected_row_version=expected
            )
        except OrderServiceError as exc:
            return fail(str(exc), code=exc.code, errors=exc.errors, request=request, http_status=exc.status)
        write_audit(request=request, action='order.confirm', target_type='order', target_id=str(order.id))
        return ok(serialize_order(updated), request=request)


class OrderCancelView(APIView):
    permission_classes = STAFF

    def post(self, request, order_id):
        order = Order.objects.select_related('organization').filter(pk=order_id).first()
        if not order:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        try:
            expected = int(body.get('expected_row_version'))
        except (TypeError, ValueError):
            return fail('expected_row_version required', code='VALIDATION_ERROR', request=request)
        try:
            updated = cancel_order(
                organization=order.organization, order_id=order.id, expected_row_version=expected
            )
        except OrderServiceError as exc:
            return fail(str(exc), code=exc.code, errors=exc.errors, request=request, http_status=exc.status)
        write_audit(request=request, action='order.cancel', target_type='order', target_id=str(order.id))
        return ok(serialize_order(updated), request=request)


class QuoteListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = Quote.objects.select_related('organization', 'design').order_by('-created_at')
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(q.id),
                'status': q.status,
                'organization_id': str(q.organization_id),
                'design_id': str(q.design_id) if q.design_id else None,
                'currency': q.currency,
                'total_amount': str(q.total_amount) if q.total_amount is not None else None,
                'created_at': q.created_at.isoformat(),
            }
            for q in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class DielineVariantListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = AssetVariant.objects.select_related('organization', 'family').order_by('-updated_at')
        qs = _q_search(qs, request, ['title_zh', 'title_ko', 'material_name'])
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(v.id),
                'title_zh': v.title_zh,
                'organization_id': str(v.organization_id),
                'family': v.family.name_zh if v.family_id else None,
                'length_mm': str(v.length_mm) if v.length_mm is not None else None,
                'width_mm': str(v.width_mm) if v.width_mm is not None else None,
                'height_mm': str(v.height_mm) if v.height_mm is not None else None,
                'is_example': v.is_example,
            }
            for v in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class DielineRevisionListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = ImmutableRevision.objects.select_related('variant').order_by('-created_at')
        pub = (request.query_params.get('publication_status') or '').strip()
        if pub:
            qs = qs.filter(publication_status=pub)
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(r.id),
                'variant_id': str(r.variant_id),
                'revision_no': r.revision_no,
                'publication_status': r.publication_status,
                'rights_status': r.rights_status,
                'acquisition_status': r.acquisition_status,
                'format': r.format,
                'created_at': r.created_at.isoformat(),
            }
            for r in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class DielinePublishView(APIView):
    permission_classes = STAFF

    def post(self, request, revision_id):
        rev = ImmutableRevision.objects.filter(pk=revision_id).first()
        if not rev:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        action = str(body.get('action') or 'publish')
        if action == 'publish':
            rev.publication_status = ImmutableRevision.PublicationStatus.PUBLISHED
        elif action == 'revoke':
            rev.publication_status = ImmutableRevision.PublicationStatus.REVOKED
        elif action == 'review':
            rev.publication_status = ImmutableRevision.PublicationStatus.REVIEW
        else:
            return fail('action must be publish|revoke|review', code='VALIDATION_ERROR', request=request)
        rev.save(update_fields=['publication_status'])
        write_audit(
            request=request,
            action=f'dieline.{action}',
            target_type='immutable_revision',
            target_id=str(rev.id),
            meta={'publication_status': rev.publication_status},
        )
        return ok({'id': str(rev.id), 'publication_status': rev.publication_status}, request=request)


class DielineGrantView(APIView):
    permission_classes = STAFF

    def post(self, request, revision_id):
        rev = ImmutableRevision.objects.filter(pk=revision_id).first()
        if not rev:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        grant, _ = UsageGrant.objects.get_or_create(revision=rev)
        for field in (
            'can_store',
            'can_transform',
            'can_use_internally',
            'can_use_commercially',
            'can_show_public_preview',
            'can_redistribute_files',
        ):
            if field in body:
                setattr(grant, field, bool(body[field]))
        if 'attribution' in body:
            grant.attribution = str(body.get('attribution') or '')[:255]
        grant.save()
        rev.rights_status = ImmutableRevision.RightsStatus.GRANTED
        rev.save(update_fields=['rights_status'])
        write_audit(request=request, action='dieline.grant', target_type='usage_grant', target_id=str(grant.id))
        return ok(
            {
                'id': str(grant.id),
                'revision_id': str(rev.id),
                'can_store': grant.can_store,
                'can_use_internally': grant.can_use_internally,
                'can_show_public_preview': grant.can_show_public_preview,
            },
            request=request,
        )


class AcquisitionJobListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = AcquisitionJob.objects.select_related('organization', 'plan').order_by('-created_at')
        status = (request.query_params.get('status') or '').strip()
        if status:
            qs = qs.filter(status=status)
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(j.id),
                'status': j.status,
                'organization_id': str(j.organization_id),
                'plan_id': str(j.plan_id) if j.plan_id else None,
                'error_message': j.last_error or '',
                'created_at': j.created_at.isoformat(),
            }
            for j in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class AcquisitionJobRetryView(APIView):
    permission_classes = STAFF

    def post(self, request, job_id):
        job = AcquisitionJob.objects.filter(pk=job_id).first()
        if not job:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        if job.status not in (AcquisitionJob.Status.FAILED, AcquisitionJob.Status.CANCELLED):
            return fail('only failed/cancelled jobs can retry', code='INVALID_STATUS', request=request)
        job.status = AcquisitionJob.Status.PENDING
        job.last_error = ''
        job.last_error_code = ''
        job.finished_at = None
        job.save(update_fields=['status', 'last_error', 'last_error_code', 'finished_at', 'updated_at'])
        dispatch_acquisition_job.delay(str(job.id))
        write_audit(request=request, action='acquisition.retry', target_type='acquisition_job', target_id=str(job.id))
        return ok({'id': str(job.id), 'status': job.status}, request=request)


class AssetListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = Asset.objects.select_related('organization', 'owner').order_by('-created_at')
        mime = (request.query_params.get('mime') or '').strip()
        if mime:
            qs = qs.filter(mime__startswith=mime)
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(a.id),
                'filename': a.original_filename,
                'mime': a.mime,
                'status': a.status,
                'organization_id': str(a.organization_id),
                'bytes': a.byte_size,
                'created_at': a.created_at.isoformat(),
            }
            for a in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class AssetThumbRegenView(APIView):
    permission_classes = STAFF

    def post(self, request, asset_id):
        asset = Asset.objects.filter(pk=asset_id).first()
        if not asset:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        generate_thumbnail.delay(str(asset.id), True)
        write_audit(request=request, action='asset.thumb_regen', target_type='asset', target_id=str(asset.id))
        return ok({'id': str(asset.id), 'queued': True}, request=request)


class AiJobListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = AiJob.objects.select_related('organization', 'design').order_by('-created_at')
        status = (request.query_params.get('status') or '').strip()
        if status:
            qs = qs.filter(status=status)
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(j.id),
                'operation': j.operation,
                'status': j.status,
                'provider': j.provider,
                'organization_id': str(j.organization_id),
                'design_id': str(j.design_id),
                'error_code': j.error_code,
                'created_at': j.created_at.isoformat(),
            }
            for j in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class AiUsageListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = UsageLedger.objects.select_related('organization').order_by('-created_at')
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(e.id),
                'organization_id': str(e.organization_id),
                'delta': e.delta,
                'reason': e.reason,
                'created_at': e.created_at.isoformat(),
            }
            for e in items
        ]
        return ok({'items': data, 'page': page}, request=request)


class AiConfigView(APIView):
    permission_classes = STAFF

    def get(self, request):
        return ok(serialize_config_public(), request=request)

    def put(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        row = get_or_create_config()
        provider = str(body.get('provider') or row.provider or 'disabled').strip().lower()
        allowed = {'disabled', 'gemini', 'openai', 'test', 'gemini_images', 'openai_images'}
        if provider not in allowed:
            return fail('invalid provider', code='VALIDATION_ERROR', request=request)
        if provider in ('gemini_images',):
            provider = 'gemini'
        if provider in ('openai_images',):
            provider = 'openai'
        row.provider = provider
        if 'model' in body:
            row.model = str(body.get('model') or '')[:120]
        if 'gemini_base_url' in body:
            row.gemini_base_url = str(body.get('gemini_base_url') or '')[:255]
        if 'openai_images_url' in body:
            row.openai_images_url = str(body.get('openai_images_url') or '')[:255]
        api_key = body.get('api_key')
        if isinstance(api_key, str) and api_key.strip():
            row.api_key_encrypted = encrypt_api_key(api_key.strip())
        row.updated_by = request.user
        row.save()
        write_audit(
            request=request,
            action='ai.config.put',
            target_type='ai_provider_config',
            target_id='1',
            meta={'provider': row.provider, 'model': row.model, 'key_updated': bool(api_key)},
        )
        return ok(serialize_config_public(), request=request)


class AiConfigTestView(APIView):
    permission_classes = STAFF

    def post(self, request):
        cfg = resolved_settings()
        provider = cfg['provider']
        if provider in ('', 'disabled'):
            return ok({'ok': False, 'reason': 'provider_disabled'}, request=request)
        if provider == 'test':
            return ok({'ok': True, 'reason': 'test_provider'}, request=request)
        if not cfg['api_key']:
            return ok({'ok': False, 'reason': 'missing_key'}, request=request)
        try:
            if provider == 'gemini':
                model = (cfg['model'] or 'gemini-2.5-flash-image').strip()
                base = cfg['gemini_base_url'].rstrip('/')
                url = f'{base}/models/{model}'
                resp = requests.get(url, headers={'x-goog-api-key': cfg['api_key']}, timeout=15)
                ok_flag = resp.status_code < 500
                return ok(
                    {'ok': resp.status_code < 400, 'http_status': resp.status_code, 'reachable': ok_flag},
                    request=request,
                )
            if provider == 'openai':
                resp = requests.get(
                    'https://api.openai.com/v1/models',
                    headers={'Authorization': f"Bearer {cfg['api_key']}"},
                    timeout=15,
                )
                return ok({'ok': resp.status_code < 400, 'http_status': resp.status_code}, request=request)
            return ok({'ok': False, 'reason': f'unsupported:{provider}'}, request=request)
        except Exception as exc:  # noqa: BLE001
            return ok({'ok': False, 'reason': str(exc)[:200]}, request=request)


class AuditListView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = ConsoleAuditLog.objects.select_related('actor').order_by('-created_at')
        action = (request.query_params.get('action') or '').strip()
        if action:
            qs = qs.filter(action__icontains=action)
        items, page = paginate_queryset(qs, request)
        data = [
            {
                'id': str(a.id),
                'action': a.action,
                'target_type': a.target_type,
                'target_id': a.target_id,
                'actor_email': a.actor.email if a.actor_id else None,
                'meta': a.meta,
                'ip': a.ip,
                'created_at': a.created_at.isoformat(),
            }
            for a in items
        ]
        return ok({'items': data, 'page': page}, request=request)
