from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_jobs.capabilities import list_capabilities
from apps.ai_jobs.errors import AiJobError
from apps.ai_jobs.models import AiJob
from apps.ai_jobs.services import apply_ai_job, cancel_ai_job, create_ai_job, serialize_job
from apps.assets.serializers import AssetSerializer
from apps.designs.models import Design
from apps.organizations.permissions import org_ids_for, require_org_membership
from config.api import fail, ok


def _service_error(request, exc: AiJobError):
    return Response(
        {
            'code': exc.code,
            'message': str(exc),
            'data': exc.data,
            'errors': exc.errors,
            'request_id': getattr(request, 'request_id', None),
        },
        status=exc.status,
    )


def _get_design(user, design_id) -> Design | None:
    design = Design.objects.select_related('current_revision', 'organization').filter(id=design_id).first()
    if not design or not require_org_membership(user, design.organization_id):
        return None
    return design


def _get_job(user, job_id) -> AiJob | None:
    job = AiJob.objects.select_related('design', 'result_asset', 'organization').filter(id=job_id).first()
    if not job or not require_org_membership(user, job.organization_id):
        return None
    return job


class AiCapabilitiesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return ok(list_capabilities(), request=request)


class DesignAiJobCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, design_id):
        design = _get_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        idem = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key')
        try:
            data, status, _replay = create_ai_job(
                design=design,
                user=request.user,
                operation=request.data.get('operation') or AiJob.Operation.IMAGE_GENERATE,
                prompt=request.data.get('prompt') or '',
                idempotency_key=idem,
                registration=request.data.get('registration'),
            )
        except AiJobError as exc:
            return _service_error(request, exc)
        return ok(data, message='已创建任务' if status == 202 else '幂等重放', request=request, http_status=status)


class DesignGeneratedAssetsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, design_id):
        design = _get_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        jobs = (
            AiJob.objects.filter(
                design=design,
                organization_id__in=org_ids_for(request.user),
                status=AiJob.Status.SUCCEEDED,
                result_asset__isnull=False,
            )
            .select_related('result_asset')
            .order_by('-finished_at')[:50]
        )
        items = []
        for job in jobs:
            items.append(
                {
                    'job_id': str(job.id),
                    'operation': job.operation,
                    'prompt': job.prompt,
                    'asset': AssetSerializer(job.result_asset).data,
                    'finished_at': job.finished_at.isoformat() if job.finished_at else None,
                }
            )
        return ok({'items': items}, request=request)


class AiJobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = _get_job(request.user, job_id)
        if not job:
            return fail('无权访问任务', code='FORBIDDEN', request=request, http_status=403)
        return ok(serialize_job(job), request=request)


class AiJobCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        job = _get_job(request.user, job_id)
        if not job:
            return fail('无权访问任务', code='FORBIDDEN', request=request, http_status=403)
        try:
            data = cancel_ai_job(job=job)
        except AiJobError as exc:
            return _service_error(request, exc)
        return ok(data, message='已取消', request=request)


class AiJobApplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        job = _get_job(request.user, job_id)
        if not job:
            return fail('无权访问任务', code='FORBIDDEN', request=request, http_status=403)
        expected = request.data.get('expected_row_version')
        try:
            expected_i = int(expected)
        except (TypeError, ValueError):
            return fail('expected_row_version 无效', code='VALIDATION_ERROR', request=request)
        panel_id = request.data.get('panel_id') or ''
        side = request.data.get('side') or 'outside'
        try:
            data, status = apply_ai_job(
                job=job,
                user=request.user,
                expected_row_version=expected_i,
                panel_id=panel_id,
                side=side,
                width_mm=request.data.get('width_mm'),
                height_mm=request.data.get('height_mm'),
                origin_x_mm=request.data.get('origin_x_mm'),
                origin_y_mm=request.data.get('origin_y_mm'),
                registration=request.data.get('registration'),
            )
        except AiJobError as exc:
            return _service_error(request, exc)
        return ok(data, message='已应用到设计', request=request, http_status=status)
