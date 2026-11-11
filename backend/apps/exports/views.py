from django.http import FileResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assets.services import absolute_path
from apps.designs.models import Design
from apps.exports.errors import ExportJobError
from apps.exports.models import ExportJob
from apps.exports.services import create_export_job, serialize_job
from apps.organizations.permissions import require_org_membership
from config.api import fail, ok


def _service_error(request, exc: ExportJobError):
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


def _get_job(user, job_id) -> ExportJob | None:
    job = ExportJob.objects.select_related('design', 'result_asset', 'organization', 'input_revision').filter(
        id=job_id
    ).first()
    if not job or not require_org_membership(user, job.organization_id):
        return None
    return job


class DesignExportCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, design_id):
        design = _get_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        idem = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key')
        try:
            data, status, _replay = create_export_job(
                design=design,
                user=request.user,
                format=request.data.get('format') or '',
                quality_tier=request.data.get('quality_tier') or ExportJob.QualityTier.VECTOR_PROOF,
                revision_id=request.data.get('revision_id'),
                options=request.data.get('options'),
                idempotency_key=idem,
            )
        except ExportJobError as exc:
            return _service_error(request, exc)
        return ok(
            data,
            message='已创建导出任务' if status == 202 else '幂等重放',
            request=request,
            http_status=status,
        )


class ExportJobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, export_id):
        job = _get_job(request.user, export_id)
        if not job:
            return fail('无权访问导出任务', code='FORBIDDEN', request=request, http_status=403)
        return ok(serialize_job(job), request=request)


class ExportJobDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, export_id):
        job = _get_job(request.user, export_id)
        if not job:
            return fail('无权访问导出任务', code='FORBIDDEN', request=request, http_status=403)
        if job.status != ExportJob.Status.SUCCEEDED or not job.result_asset_id:
            return fail('导出尚未完成', code='EXPORT_NOT_READY', request=request, http_status=400)
        asset = job.result_asset
        if not asset or asset.status != asset.Status.READY:
            return fail('导出文件不可用', code='ASSET_NOT_READY', request=request, http_status=400)
        path = absolute_path(asset)
        if not path.exists():
            return fail('文件缺失', code='ASSET_MISSING', request=request, http_status=404)
        handle = path.open('rb')
        return FileResponse(
            handle,
            content_type=asset.mime,
            filename=asset.original_filename or path.name,
        )
