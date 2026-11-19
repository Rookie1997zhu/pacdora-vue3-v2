from pathlib import Path

from django.db import transaction
from django.http import FileResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_jobs.models import AiJob
from apps.assets.models import AssetDerivative
from apps.assets.services import derivative_absolute_path
from apps.catalog.models import Product
from apps.designs.models import Design, DesignRevision, DesignViewPreference
from apps.designs.serializers import DesignDetailSerializer, DesignListSerializer, DesignRevisionSerializer
from apps.designs.services import DesignServiceError, copy_design, create_design, save_revision
from apps.designs.tasks import DIELINE_KIND
from apps.exports.models import ExportJob
from apps.orders.models import CartItem, OrderItem
from apps.organizations.permissions import org_ids_for, primary_org, require_org_membership
from apps.quotes.models import Quote
from config.api import fail, ok
from config.throttles import RevisionSaveRateThrottle


def _service_error(request, exc: DesignServiceError):
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


def _get_owned_design(user, design_id) -> Design | None:
    design = (
        Design.objects.select_related(
            'current_revision',
            'product',
            'product__default_template_version',
            'organization',
        )
        .filter(id=design_id)
        .first()
    )
    if not design or not require_org_membership(user, design.organization_id):
        return None
    return design


class DesignListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Design.objects.filter(organization_id__in=org_ids_for(request.user))
            .select_related('product', 'current_revision')
            .order_by('-updated_at')
        )
        status = request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        else:
            qs = qs.filter(status=Design.Status.ACTIVE)
        items = DesignListSerializer(qs[:100], many=True).data
        return ok({'items': items, 'page': 1, 'page_size': len(items), 'total': len(items)}, request=request)

    def post(self, request):
        org = primary_org(request.user)
        if not org:
            return fail('用户无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        name = (request.data.get('name') or '未命名设计').strip()[:200]
        product = None
        product_slug = request.data.get('product_slug')
        if product_slug:
            product = Product.objects.filter(slug=product_slug, status=Product.Status.PUBLISHED).select_related(
                'default_template',
                'default_template_version',
            ).first()
        initial = request.data.get('content')
        if product_slug and not product and initial is None:
            # Without content the product is needed for its default template and params.
            # With content (workbench: folding / tray templates have no catalogue product) the
            # design carries its own templateId, which save_revision validates.
            return fail('产品不存在', code='NOT_FOUND', request=request, http_status=404)
        client_geometry_hash = request.data.get('client_geometry_hash')
        if initial is None and product:
            ver = product.default_template_version or product.default_template.versions.filter(is_current=True).first()
            caps = product.capabilities or {}
            defaults = caps.get('default_params') or {
                'lengthMm': 300,
                'widthMm': 200,
                'heightMm': 50,
                'thicknessMm': 1.5,
                'sizeMode': 'inner',
                'fluteDirection': 'L',
                'materialId': 'kraft',
                'bleedInputMm': 3,
                'advanced': {},
            }
            initial = {
                'schemaVersion': 'boxcraft.design.v1',
                'locale': request.data.get('locale') or 'zh-CN',
                'geometry': {
                    'mode': product.default_template.geometry_mode,
                    'templateId': product.default_template.template_key,
                    'templateVersion': ver.version if ver else '1',
                    'engineVersion': ver.engine_version if ver else 'boxcraft.knife.v3',
                    'params': defaults,
                    'geometryHash': 'pending',
                },
                'artwork': {'backgroundColor': None, 'layers': []},
                'aiSettings': None,
                'outbox': {
                    'enabled': False,
                    'sizingMode': 'grow',
                    'quantity': 1,
                    'thicknessMm': 3,
                    'gapsMm': {'length': 5, 'width': 5, 'height': 5},
                },
            }
        try:
            design = create_design(
                organization=org,
                owner=request.user,
                name=name,
                product=product,
                initial_content=initial,
                client_geometry_hash=client_geometry_hash,
            )
        except DesignServiceError as exc:
            return _service_error(request, exc)
        design = Design.objects.select_related(
            'current_revision',
            'product',
            'product__default_template_version',
        ).get(pk=design.pk)
        return ok(DesignDetailSerializer(design).data, message='已创建', request=request, http_status=201)


class DesignDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, design_id):
        design = _get_owned_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        return ok(DesignDetailSerializer(design).data, request=request)

    def patch(self, request, design_id):
        design = _get_owned_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        if 'name' in request.data:
            design.name = str(request.data.get('name') or design.name).strip()[:200]
        if 'status' in request.data:
            status = request.data.get('status')
            if status == Design.Status.ARCHIVED:
                design.status = Design.Status.ARCHIVED
                design.archived_at = timezone.now()
            elif status == Design.Status.ACTIVE:
                design.status = Design.Status.ACTIVE
                design.archived_at = None
            else:
                return fail('非法状态', code='VALIDATION_ERROR', request=request)
        design.save()
        return ok(DesignDetailSerializer(design).data, request=request)

    def delete(self, request, design_id):
        design = _get_owned_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        if OrderItem.objects.filter(design_id=design.id).exists():
            return fail(
                '该设计已关联订单，无法删除，请改用归档',
                code='DESIGN_IN_USE',
                request=request,
                http_status=409,
            )
        # ExportJob/AiJob/Quote/CartItem protect DesignRevision; clear them before cascade.
        with transaction.atomic():
            ExportJob.objects.filter(design_id=design.id).delete()
            AiJob.objects.filter(design_id=design.id).delete()
            CartItem.objects.filter(design_id=design.id).delete()
            Quote.objects.filter(design_id=design.id).delete()
            if design.current_revision_id:
                design.current_revision = None
                design.save(update_fields=['current_revision', 'updated_at'])
            design.delete()
        return ok({}, message='已删除', request=request)


class DesignRevisionListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [RevisionSaveRateThrottle]

    def get(self, request, design_id):
        design = _get_owned_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        rows = design.revisions.order_by('-revision_no')[:50]
        return ok({'items': DesignRevisionSerializer(rows, many=True).data}, request=request)

    def post(self, request, design_id):
        design = _get_owned_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        content = request.data.get('content')
        expected = request.data.get('expected_row_version')
        if not isinstance(content, dict):
            return fail('缺少 content', code='VALIDATION_ERROR', request=request)
        try:
            expected_i = int(expected)
        except (TypeError, ValueError):
            return fail('expected_row_version 无效', code='VALIDATION_ERROR', request=request)
        idem = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key')
        autosave = bool(request.data.get('autosave'))
        client_geometry_hash = request.data.get('client_geometry_hash')
        try:
            data, status, _replay = save_revision(
                design=design,
                user=request.user,
                content=content,
                expected_row_version=expected_i,
                idempotency_key=idem,
                autosave=autosave,
                client_geometry_hash=client_geometry_hash,
            )
        except DesignServiceError as exc:
            return _service_error(request, exc)
        return ok(data, message='已保存版本', request=request, http_status=status)


class RevisionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, revision_id):
        rev = DesignRevision.objects.select_related('design').filter(id=revision_id).first()
        if not rev or not require_org_membership(request.user, rev.design.organization_id):
            return fail('无权访问版本', code='FORBIDDEN', request=request, http_status=403)
        data = DesignRevisionSerializer(rev).data
        data['content'] = rev.content_json
        data['design_id'] = str(rev.design_id)
        return ok(data, request=request)


class DesignDielineThumbnailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, design_id):
        design = _get_owned_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        if not design.dieline_preview_asset_id:
            return fail('刀版缩略图未就绪', code='THUMBNAIL_NOT_READY', request=request, http_status=404)
        derivative = AssetDerivative.objects.filter(
            asset_id=design.dieline_preview_asset_id,
            kind=DIELINE_KIND,
        ).first()
        if not derivative:
            return fail('刀版缩略图未就绪', code='THUMBNAIL_NOT_READY', request=request, http_status=404)
        path = derivative_absolute_path(derivative)
        if not path.exists():
            return fail('刀版缩略图未就绪', code='THUMBNAIL_NOT_READY', request=request, http_status=404)
        handle = Path(path).open('rb')
        response = FileResponse(handle, content_type='image/svg+xml', filename=path.name)
        response['Content-Security-Policy'] = "default-src 'none'"
        return response


class DesignCopyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, design_id):
        design = _get_owned_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        try:
            copied = copy_design(source=design, user=request.user, name=request.data.get('name'))
        except DesignServiceError as exc:
            return _service_error(request, exc)
        copied = Design.objects.select_related('current_revision', 'product').get(pk=copied.pk)
        return ok(DesignDetailSerializer(copied).data, message='已复制', request=request, http_status=201)


class DesignViewPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, design_id):
        design = _get_owned_design(request.user, design_id)
        if not design:
            return fail('无权访问设计', code='FORBIDDEN', request=request, http_status=403)
        pref, _ = DesignViewPreference.objects.get_or_create(user=request.user, design=design)
        for field in ('camera', 'selected_layer_ids'):
            if field in request.data:
                setattr(pref, field, request.data.get(field) or {})
        if 'zoom' in request.data:
            pref.zoom = float(request.data.get('zoom') or 1)
        if 'fold_progress' in request.data:
            pref.fold_progress = float(request.data.get('fold_progress') or 0)
        if 'tool' in request.data:
            pref.tool = str(request.data.get('tool') or '')[:64]
        pref.save()
        return ok(
            {
                'camera': pref.camera,
                'zoom': pref.zoom,
                'fold_progress': pref.fold_progress,
                'tool': pref.tool,
                'selected_layer_ids': pref.selected_layer_ids,
            },
            request=request,
        )
