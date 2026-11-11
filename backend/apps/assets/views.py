from django.http import FileResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.assets.models import Asset, AssetDerivative
from apps.assets.preview import THUMB_KIND
from apps.assets.serializers import AssetSerializer
from apps.assets.services import AssetUploadError, absolute_path, derivative_absolute_path, store_upload
from apps.organizations.permissions import org_ids_for, primary_org, require_org_membership
from config.api import fail, ok


class AssetListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        qs = Asset.objects.filter(
            organization_id__in=org_ids_for(request.user),
            status=Asset.Status.READY,
        ).order_by('-created_at')[:100]
        return ok({'items': AssetSerializer(qs, many=True).data}, request=request)

    @method_decorator(csrf_protect)
    def post(self, request):
        uploaded = request.FILES.get('file')
        if not uploaded:
            return fail('缺少 file', code='VALIDATION_ERROR', request=request)
        org = primary_org(request.user)
        if not org:
            return fail('用户无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        try:
            asset = store_upload(organization=org, owner=request.user, uploaded_file=uploaded)
        except AssetUploadError as exc:
            return fail(str(exc), code=exc.code, request=request, http_status=400)
        return ok(AssetSerializer(asset).data, message='上传成功', request=request, http_status=201)


class AssetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, asset_id):
        asset = Asset.objects.filter(id=asset_id).first()
        if not asset or not require_org_membership(request.user, asset.organization_id):
            return fail('无权访问资产', code='FORBIDDEN', request=request, http_status=403)
        return ok(AssetSerializer(asset).data, request=request)


class AssetContentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, asset_id):
        asset = Asset.objects.filter(id=asset_id).first()
        if not asset or not require_org_membership(request.user, asset.organization_id):
            return fail('无权访问资产', code='FORBIDDEN', request=request, http_status=403)
        if asset.status != Asset.Status.READY:
            return fail('资产不可用', code='ASSET_NOT_READY', request=request, http_status=400)
        path = absolute_path(asset)
        if not path.exists():
            return fail('文件缺失', code='ASSET_MISSING', request=request, http_status=404)
        handle = path.open('rb')
        response = FileResponse(handle, content_type=asset.mime, filename=asset.original_filename or path.name)
        return response


class AssetThumbnailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, asset_id):
        asset = Asset.objects.filter(id=asset_id).first()
        if not asset or not require_org_membership(request.user, asset.organization_id):
            return fail('无权访问资产', code='FORBIDDEN', request=request, http_status=403)
        derivative = AssetDerivative.objects.filter(asset=asset, kind=THUMB_KIND).first()
        if not derivative:
            return fail('缩略图未就绪', code='THUMBNAIL_NOT_READY', request=request, http_status=404)
        path = derivative_absolute_path(derivative)
        if not path.exists():
            return fail('缩略图未就绪', code='THUMBNAIL_NOT_READY', request=request, http_status=404)
        handle = path.open('rb')
        return FileResponse(handle, content_type=derivative.mime or 'image/webp', filename=path.name)
