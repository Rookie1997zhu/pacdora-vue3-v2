import json

from django.http import HttpResponse
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assets.services import absolute_path
from apps.organizations.permissions import org_ids_for, primary_org, require_org_membership
from apps.render_scenes.document import create_default_scene, upgrade_scene_to_v2
from apps.render_scenes.errors import RenderSceneError
from apps.render_scenes.jobs import create_render_batch, create_render_job, serialize_batch, serialize_job
from apps.render_scenes.models import (
    RenderBatch,
    RenderEnvironment,
    RenderJob,
    RenderProp,
    RenderScene,
    RenderSceneTemplate,
)
from apps.render_scenes.result_files import (
    delete_result,
    download_filename,
    mime_for_path,
    resolve_result_path,
)
from apps.render_scenes.serializers import (
    RenderEnvironmentSerializer,
    RenderPropSerializer,
    RenderSceneDetailSerializer,
    RenderSceneListSerializer,
    RenderSceneTemplateSerializer,
)
from apps.render_scenes.services import (
    apply_template_to_scene,
    copy_render_scene,
    create_render_scene,
    create_user_prop,
    delete_user_prop,
    list_props,
    update_render_scene,
)
from config.api import fail, ok


def _service_error(request, exc: RenderSceneError):
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


def _get_owned_scene(user, scene_id) -> RenderScene | None:
    scene = (
        RenderScene.objects.select_related('organization', 'cover_asset', 'owner')
        .filter(id=scene_id)
        .first()
    )
    if not scene or not require_org_membership(user, scene.organization_id):
        return None
    return scene


class RenderSceneListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            RenderScene.objects.filter(organization_id__in=org_ids_for(request.user))
            .select_related('cover_asset')
            .order_by('-updated_at')
        )
        items = RenderSceneListSerializer(qs[:100], many=True).data
        return ok(
            {'items': items, 'page': 1, 'page_size': len(items), 'total': len(items)},
            request=request,
        )

    def post(self, request):
        org = primary_org(request.user)
        if not org:
            return fail('用户无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        name = (request.data.get('name') or '未命名场景').strip()[:200]
        content = request.data.get('content')
        if content is None:
            content = create_default_scene()
        else:
            content = upgrade_scene_to_v2(content if isinstance(content, dict) else {})
        design_id = request.data.get('design_id')
        revision_id = request.data.get('revision_id')
        if design_id and isinstance(content, dict):
            models = list(content.get('models') or [])
            import uuid as uuid_mod

            models.append(
                {
                    'id': str(uuid_mod.uuid4()),
                    'designId': str(design_id),
                    'revisionId': str(revision_id) if revision_id else None,
                    'position': {'x': 0, 'y': 0, 'z': 0},
                    'rotation': {'x': 0, 'y': 0, 'z': 0},
                    'scale': 1,
                    'foldProgress': 100,
                    'materialId': 'kraft',
                }
            )
            content = {**content, 'models': models}
        try:
            scene = create_render_scene(
                organization=org,
                owner=request.user,
                name=name,
                content=content,
            )
        except RenderSceneError as exc:
            return _service_error(request, exc)
        return ok(
            RenderSceneDetailSerializer(scene).data,
            message='已创建',
            request=request,
            http_status=201,
        )


class RenderSceneDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, scene_id):
        scene = _get_owned_scene(request.user, scene_id)
        if not scene:
            return fail('无权访问场景', code='FORBIDDEN', request=request, http_status=403)
        return ok(RenderSceneDetailSerializer(scene).data, request=request)

    def patch(self, request, scene_id):
        scene = _get_owned_scene(request.user, scene_id)
        if not scene:
            return fail('无权访问场景', code='FORBIDDEN', request=request, http_status=403)
        try:
            updated = update_render_scene(
                scene=scene,
                expected_row_version=request.data.get('expected_row_version'),
                name=request.data.get('name') if 'name' in request.data else None,
                content=request.data.get('content') if 'content' in request.data else None,
            )
        except RenderSceneError as exc:
            return _service_error(request, exc)
        return ok(RenderSceneDetailSerializer(updated).data, request=request)

    def delete(self, request, scene_id):
        scene = _get_owned_scene(request.user, scene_id)
        if not scene:
            return fail('无权访问场景', code='FORBIDDEN', request=request, http_status=403)
        scene.delete()
        return ok({}, message='已删除', request=request)


class RenderSceneCopyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, scene_id):
        scene = _get_owned_scene(request.user, scene_id)
        if not scene:
            return fail('无权访问场景', code='FORBIDDEN', request=request, http_status=403)
        try:
            copied = copy_render_scene(
                scene=scene,
                owner=request.user,
                name=request.data.get('name'),
            )
        except RenderSceneError as exc:
            return _service_error(request, exc)
        return ok(
            RenderSceneDetailSerializer(copied).data,
            message='已复制',
            request=request,
            http_status=201,
        )


class RenderSceneApplyTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, scene_id):
        scene = _get_owned_scene(request.user, scene_id)
        if not scene:
            return fail('无权访问场景', code='FORBIDDEN', request=request, http_status=403)
        try:
            updated = apply_template_to_scene(
                scene=scene,
                template_id=str(request.data.get('templateId') or request.data.get('template_id') or ''),
                bindings=request.data.get('bindings') or [],
                expected_row_version=request.data.get('expected_row_version'),
            )
        except RenderSceneError as exc:
            return _service_error(request, exc)
        return ok(RenderSceneDetailSerializer(updated).data, message='已套用模板', request=request)


def _get_owned_job(user, job_id) -> RenderJob | None:
    job = (
        RenderJob.objects.select_related('organization', 'scene', 'result_asset', 'input_asset')
        .filter(id=job_id)
        .first()
    )
    if not job or not require_org_membership(user, job.organization_id):
        return None
    return job


class RenderJobCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, scene_id):
        scene = _get_owned_scene(request.user, scene_id)
        if not scene:
            return fail('无权访问场景', code='FORBIDDEN', request=request, http_status=403)
        qs = (
            RenderJob.objects.select_related('result_asset', 'input_asset', 'batch')
            .filter(scene_id=scene.id, organization_id=scene.organization_id)
            .order_by('-created_at')[:50]
        )
        return ok({'items': RenderJobSerializer(qs, many=True).data}, request=request)

    def post(self, request, scene_id):
        scene = _get_owned_scene(request.user, scene_id)
        if not scene:
            return fail('无权访问场景', code='FORBIDDEN', request=request, http_status=403)
        uploaded = request.FILES.get('file') or request.FILES.get('glb')
        if not uploaded:
            return fail('缺少 GLB 文件', code='VALIDATION_ERROR', request=request)
        glb_bytes = uploaded.read()
        snapshot_raw = request.data.get('scene_snapshot')
        snapshot = None
        if isinstance(snapshot_raw, str) and snapshot_raw.strip():
            try:
                snapshot = json.loads(snapshot_raw)
            except json.JSONDecodeError:
                return fail('scene_snapshot 无效', code='VALIDATION_ERROR', request=request)
        elif isinstance(snapshot_raw, dict):
            snapshot = snapshot_raw
        idem = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key')
        try:
            data, status, _replay = create_render_job(
                scene=scene,
                user=request.user,
                glb_bytes=glb_bytes,
                width=request.data.get('width'),
                height=request.data.get('height'),
                format=request.data.get('format') or 'png',
                scene_snapshot=snapshot,
                idempotency_key=idem,
            )
        except RenderSceneError as exc:
            return _service_error(request, exc)
        return ok(
            data,
            message='已创建渲染任务' if status == 202 else '幂等重放',
            request=request,
            http_status=status,
        )


class RenderBatchCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, scene_id):
        scene = _get_owned_scene(request.user, scene_id)
        if not scene:
            return fail('无权访问场景', code='FORBIDDEN', request=request, http_status=403)
        uploaded = request.FILES.get('file') or request.FILES.get('glb')
        if not uploaded:
            return fail('缺少 GLB 文件', code='VALIDATION_ERROR', request=request)
        glb_bytes = uploaded.read()
        snapshot_raw = request.data.get('scene_snapshot')
        snapshot = None
        if isinstance(snapshot_raw, str) and snapshot_raw.strip():
            try:
                snapshot = json.loads(snapshot_raw)
            except json.JSONDecodeError:
                return fail('scene_snapshot 无效', code='VALIDATION_ERROR', request=request)
        elif isinstance(snapshot_raw, dict):
            snapshot = snapshot_raw

        view_ids_raw = request.data.get('view_ids') or request.data.get('viewIds') or '[]'
        if isinstance(view_ids_raw, str):
            try:
                view_ids = json.loads(view_ids_raw)
            except json.JSONDecodeError:
                view_ids = [v for v in view_ids_raw.split(',') if v.strip()]
        elif isinstance(view_ids_raw, list):
            view_ids = view_ids_raw
        else:
            view_ids = []

        idem = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key')
        try:
            data, status, _replay = create_render_batch(
                scene=scene,
                user=request.user,
                glb_bytes=glb_bytes,
                width=request.data.get('width'),
                height=request.data.get('height'),
                format=request.data.get('format') or 'png',
                view_ids=view_ids,
                scene_snapshot=snapshot,
                idempotency_key=idem,
            )
        except RenderSceneError as exc:
            return _service_error(request, exc)
        return ok(
            data,
            message='已创建批量渲染' if status == 202 else '幂等重放',
            request=request,
            http_status=status,
        )


class RenderBatchDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        batch = (
            RenderBatch.objects.select_related('organization', 'scene')
            .filter(id=batch_id)
            .first()
        )
        if not batch or not require_org_membership(request.user, batch.organization_id):
            return fail('无权访问批量任务', code='FORBIDDEN', request=request, http_status=403)
        return ok(serialize_batch(batch), request=request)


class RenderJobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = _get_owned_job(request.user, job_id)
        if not job:
            return fail('无权访问渲染任务', code='FORBIDDEN', request=request, http_status=403)
        return ok(serialize_job(job), request=request)


class RenderJobDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = _get_owned_job(request.user, job_id)
        if not job:
            return fail('无权访问渲染任务', code='FORBIDDEN', request=request, http_status=403)
        if job.status != RenderJob.Status.SUCCEEDED:
            return fail('渲染尚未完成', code='RENDER_NOT_READY', request=request, http_status=400)

        # Prefer archived Asset; ephemeral path is migration-only fallback.
        path = None
        if job.result_asset_id and job.result_asset:
            candidate = absolute_path(job.result_asset)
            if candidate.is_file():
                path = candidate
            else:
                return fail('文件缺失', code='ASSET_MISSING', request=request, http_status=404)
        if path is None:
            path = resolve_result_path(job.id, format=job.format)
        if not path:
            return fail('文件缺失', code='ASSET_MISSING', request=request, http_status=404)

        filename = download_filename(job.id, path)
        content_type = mime_for_path(path)
        # Repeatable download: keep Asset / migration ephemeral file.
        response = HttpResponse(path.read_bytes(), content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class RenderPropListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        org = primary_org(request.user)
        if not org:
            return fail('用户无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        scope = (request.query_params.get('scope') or 'official').strip().lower()
        if scope not in ('official', 'mine'):
            scope = 'official'
        qs = list_props(organization_id=org.id, scope=scope)
        return ok({'items': RenderPropSerializer(qs[:200], many=True).data}, request=request)

    def post(self, request):
        org = primary_org(request.user)
        if not org:
            return fail('用户无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        uploaded = request.FILES.get('file') or request.FILES.get('glb')
        if not uploaded:
            return fail('缺少 GLB 文件', code='VALIDATION_ERROR', request=request)
        name = (request.data.get('name') or uploaded.name or '我的道具').strip()[:200]
        try:
            prop = create_user_prop(
                organization=org,
                owner=request.user,
                name=name,
                glb_bytes=uploaded.read(),
            )
        except RenderSceneError as exc:
            return _service_error(request, exc)
        return ok(RenderPropSerializer(prop).data, message='已上传', request=request, http_status=201)


class RenderPropDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, prop_id):
        prop = RenderProp.objects.filter(id=prop_id).first()
        if not prop:
            return fail('道具不存在', code='NOT_FOUND', request=request, http_status=404)
        if prop.organization_id and not require_org_membership(request.user, prop.organization_id):
            return fail('无权访问道具', code='FORBIDDEN', request=request, http_status=403)
        try:
            delete_user_prop(prop=prop, user=request.user)
        except RenderSceneError as exc:
            return _service_error(request, exc)
        return ok({}, message='已删除', request=request)


class RenderPropDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, prop_id):
        prop = RenderProp.objects.select_related('asset').filter(id=prop_id).first()
        if not prop:
            return fail('道具不存在', code='NOT_FOUND', request=request, http_status=404)
        if prop.is_official:
            pass
        elif not prop.organization_id or not require_org_membership(request.user, prop.organization_id):
            return fail('无权访问道具', code='FORBIDDEN', request=request, http_status=403)
        asset = prop.asset
        path = absolute_path(asset)
        if not path.exists():
            return fail('文件缺失', code='ASSET_MISSING', request=request, http_status=404)
        return FileResponse(path.open('rb'), content_type='model/gltf-binary', filename=asset.original_filename or 'prop.glb')


class RenderEnvironmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = RenderEnvironment.objects.select_related('asset').order_by('sort_order', 'id')
        return ok({'items': RenderEnvironmentSerializer(qs, many=True).data}, request=request)


class RenderEnvironmentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, env_id):
        env = RenderEnvironment.objects.select_related('asset').filter(pk=env_id).first()
        if not env:
            return fail('环境不存在', code='NOT_FOUND', request=request, http_status=404)
        path = absolute_path(env.asset)
        if not path.exists():
            return fail('文件缺失', code='ASSET_MISSING', request=request, http_status=404)
        return FileResponse(
            path.open('rb'),
            content_type='image/vnd.radiance',
            filename=env.asset.original_filename or f'{env.id}.hdr',
        )


class RenderSceneTemplateListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = RenderSceneTemplate.objects.order_by('sort_order', 'id')
        return ok({'items': RenderSceneTemplateSerializer(qs, many=True).data}, request=request)


class RenderSceneTemplateDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, template_id):
        tpl = RenderSceneTemplate.objects.filter(pk=template_id).first()
        if not tpl:
            return fail('模板不存在', code='NOT_FOUND', request=request, http_status=404)
        return ok(RenderSceneTemplateSerializer(tpl).data, request=request)
