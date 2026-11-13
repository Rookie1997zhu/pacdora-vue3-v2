from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.console.audit import write_audit
from apps.console.pagination import paginate_queryset
from apps.console.permissions import IsStaffUser
from apps.organizations.services import ensure_personal_org
from apps.samples.models import SampleTestRecord
from apps.samples.services import (
    SampleServiceError,
    attach_evidence,
    create_sample_test,
    review_sample,
    serialize_sample,
)
from config.api import fail, ok

STAFF = [IsAuthenticated, IsStaffUser]


class SampleTestListCreateView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = SampleTestRecord.objects.select_related(
            'organization',
            'template_version',
            'design_revision',
            'created_by',
            'reviewed_by',
        ).prefetch_related('evidence_assets').order_by('-created_at')
        template_key = (request.query_params.get('template_key') or '').strip()
        if template_key:
            qs = qs.filter(template_key=template_key)
        verdict = (request.query_params.get('verdict') or '').strip()
        if verdict:
            qs = qs.filter(verdict=verdict)
        org = request.query_params.get('organization_id')
        if org:
            qs = qs.filter(organization_id=org)
        items, page = paginate_queryset(qs, request)
        return ok({'items': [serialize_sample(r) for r in items], 'page': page}, request=request)

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        org_id = body.get('organization_id')
        if org_id:
            from apps.organizations.models import Organization

            org = Organization.objects.filter(pk=org_id).first()
            if not org:
                return fail('organization not found', code='NOT_FOUND', request=request, http_status=404)
        else:
            org = ensure_personal_org(request.user)
        try:
            record = create_sample_test(organization=org, user=request.user, body=body)
        except SampleServiceError as exc:
            return fail(
                str(exc),
                code=exc.code,
                request=request,
                http_status=exc.status,
                errors=exc.errors,
            )
        write_audit(
            request=request,
            action='sample.create',
            target_type='sample_test',
            target_id=str(record.id),
            meta={'template_key': record.template_key, 'verdict': record.verdict},
        )
        return ok(serialize_sample(record), request=request, http_status=201)


class SampleTestDetailView(APIView):
    permission_classes = STAFF

    def get(self, request, sample_id):
        record = (
            SampleTestRecord.objects.select_related(
                'organization',
                'template_version',
                'design_revision',
                'created_by',
                'reviewed_by',
            )
            .prefetch_related('evidence_assets')
            .filter(pk=sample_id)
            .first()
        )
        if not record:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        return ok(serialize_sample(record), request=request)


class SampleTestEvidenceView(APIView):
    permission_classes = STAFF

    def post(self, request, sample_id):
        record = SampleTestRecord.objects.filter(pk=sample_id).first()
        if not record:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        uploaded = request.FILES.get('file')
        if not uploaded:
            return fail('file required', code='VALIDATION_ERROR', request=request)
        try:
            attach_evidence(
                record=record,
                organization=record.organization,
                owner=request.user,
                uploaded_file=uploaded,
            )
        except SampleServiceError as exc:
            return fail(
                str(exc),
                code=exc.code,
                request=request,
                http_status=exc.status,
                errors=exc.errors,
            )
        record.refresh_from_db()
        write_audit(
            request=request,
            action='sample.evidence',
            target_type='sample_test',
            target_id=str(record.id),
        )
        return ok(serialize_sample(record), request=request)


class SampleTestReviewView(APIView):
    permission_classes = STAFF

    def post(self, request, sample_id):
        record = SampleTestRecord.objects.filter(pk=sample_id).first()
        if not record:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        try:
            review_sample(
                record=record,
                reviewer=request.user,
                verdict=str(body.get('verdict') or ''),
                notes=body.get('notes'),
            )
        except SampleServiceError as exc:
            return fail(
                str(exc),
                code=exc.code,
                request=request,
                http_status=exc.status,
                errors=exc.errors,
            )
        write_audit(
            request=request,
            action='sample.review',
            target_type='sample_test',
            target_id=str(record.id),
            meta={'verdict': record.verdict},
        )
        return ok(serialize_sample(record), request=request)
