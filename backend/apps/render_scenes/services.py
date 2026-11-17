from __future__ import annotations

import copy
import uuid

from django.db import transaction
from django.db.models import F

from apps.designs.models import Design
from apps.render_scenes.document import (
    SCHEMA_VERSION,
    SceneValidationError,
    collect_design_ids,
    collect_prop_refs,
    create_default_scene,
    upgrade_scene_to_v2,
    validate_render_scene,
)
from apps.render_scenes.errors import RenderSceneError
from apps.render_scenes.models import RenderEnvironment, RenderProp, RenderScene, RenderSceneTemplate


def assert_designs_in_org(*, organization_id, content: dict) -> None:
    design_ids = collect_design_ids(content)
    if not design_ids:
        return
    unique_ids = list(dict.fromkeys(design_ids))
    # Placeholder UUID used only inside official templates before apply.
    unique_ids = [did for did in unique_ids if did != '00000000-0000-4000-8000-000000000001']
    if not unique_ids:
        return
    found = set(
        str(pk)
        for pk in Design.objects.filter(
            organization_id=organization_id,
            id__in=unique_ids,
        ).values_list('id', flat=True)
    )
    missing = [did for did in unique_ids if did not in found]
    if missing:
        raise RenderSceneError(
            'design not found in organization',
            code='DESIGN_NOT_FOUND',
            status=400,
            errors={'designId': missing},
        )


def assert_props_accessible(*, organization_id, content: dict) -> None:
    refs = collect_prop_refs(content)
    if not refs:
        return
    for ref in refs:
        prop_id = ref['propId']
        source = ref['source']
        qs = RenderProp.objects.filter(id=prop_id)
        if source == 'official':
            prop = qs.filter(is_official=True).first()
        else:
            prop = qs.filter(organization_id=organization_id, is_official=False).first()
        if not prop:
            raise RenderSceneError(
                'prop not found',
                code='PROP_NOT_FOUND',
                status=400,
                errors={'propId': [prop_id]},
            )


def assert_environment_valid(content: dict) -> None:
    env = content.get('environment') if isinstance(content.get('environment'), dict) else {}
    hdr_id = env.get('hdrId')
    if not hdr_id:
        return
    if not RenderEnvironment.objects.filter(pk=str(hdr_id)).exists():
        raise RenderSceneError(
            'environment not found',
            code='ENVIRONMENT_NOT_FOUND',
            status=400,
            errors={'hdrId': [str(hdr_id)]},
        )


def _prepare_content(content: dict | None) -> dict:
    payload = copy.deepcopy(content) if isinstance(content, dict) else create_default_scene()
    if payload.get('schemaVersion') != SCHEMA_VERSION:
        payload = upgrade_scene_to_v2(payload)
    try:
        payload = validate_render_scene(payload)
    except SceneValidationError as exc:
        raise RenderSceneError(
            str(exc),
            code='VALIDATION_ERROR',
            status=400,
            errors=exc.errors,
        ) from exc
    return payload


def create_render_scene(*, organization, owner, name: str, content: dict | None = None) -> RenderScene:
    payload = _prepare_content(content)
    assert_designs_in_org(organization_id=organization.id, content=payload)
    assert_props_accessible(organization_id=organization.id, content=payload)
    assert_environment_valid(payload)
    return RenderScene.objects.create(
        organization=organization,
        owner=owner,
        name=(name or '未命名场景').strip()[:200] or '未命名场景',
        content_json=payload,
        schema_version=payload.get('schemaVersion') or SCHEMA_VERSION,
        row_version=1,
    )


@transaction.atomic
def update_render_scene(
    *,
    scene: RenderScene,
    expected_row_version: int | None,
    name: str | None = None,
    content: dict | None = None,
) -> RenderScene:
    locked = RenderScene.objects.select_for_update().get(pk=scene.pk)
    if expected_row_version is None:
        raise RenderSceneError(
            'expected_row_version required',
            code='VALIDATION_ERROR',
            status=400,
        )
    try:
        expected = int(expected_row_version)
    except (TypeError, ValueError) as exc:
        raise RenderSceneError(
            'expected_row_version invalid',
            code='VALIDATION_ERROR',
            status=400,
        ) from exc
    if locked.row_version != expected:
        raise RenderSceneError(
            'row version conflict',
            code='ROW_VERSION_CONFLICT',
            status=409,
            data={
                'row_version': locked.row_version,
                'content': locked.content_json,
                'name': locked.name,
            },
        )

    fields = ['updated_at']
    if name is not None:
        locked.name = (name or locked.name).strip()[:200] or locked.name
        fields.append('name')
    if content is not None:
        if not isinstance(content, dict):
            raise RenderSceneError('content must be object', code='VALIDATION_ERROR', status=400)
        payload = _prepare_content(content)
        assert_designs_in_org(organization_id=locked.organization_id, content=payload)
        assert_props_accessible(organization_id=locked.organization_id, content=payload)
        assert_environment_valid(payload)
        locked.content_json = payload
        locked.schema_version = payload.get('schemaVersion') or SCHEMA_VERSION
        fields.extend(['content_json', 'schema_version'])

    locked.row_version = F('row_version') + 1
    fields.append('row_version')
    locked.save(update_fields=fields)
    locked.refresh_from_db()
    return locked


@transaction.atomic
def copy_render_scene(*, scene: RenderScene, owner, name: str | None = None) -> RenderScene:
    locked = RenderScene.objects.select_for_update().get(pk=scene.pk)
    new_name = (name or f'{locked.name} 副本').strip()[:200] or f'{locked.name} 副本'
    content = upgrade_scene_to_v2(locked.content_json or create_default_scene())
    return RenderScene.objects.create(
        organization_id=locked.organization_id,
        owner=owner,
        name=new_name,
        content_json=content,
        schema_version=SCHEMA_VERSION,
        row_version=1,
        cover_asset=None,
    )


@transaction.atomic
def apply_template_to_scene(
    *,
    scene: RenderScene,
    template_id: str,
    bindings: list[dict],
    expected_row_version: int | None,
) -> RenderScene:
    template = RenderSceneTemplate.objects.filter(pk=template_id).first()
    if not template:
        raise RenderSceneError('template not found', code='TEMPLATE_NOT_FOUND', status=404)

    locked = RenderScene.objects.select_for_update().get(pk=scene.pk)
    if expected_row_version is None:
        raise RenderSceneError(
            'expected_row_version required',
            code='VALIDATION_ERROR',
            status=400,
        )
    try:
        expected = int(expected_row_version)
    except (TypeError, ValueError) as exc:
        raise RenderSceneError(
            'expected_row_version invalid',
            code='VALIDATION_ERROR',
            status=400,
        ) from exc
    if locked.row_version != expected:
        raise RenderSceneError(
            'row version conflict',
            code='ROW_VERSION_CONFLICT',
            status=409,
            data={
                'row_version': locked.row_version,
                'content': locked.content_json,
                'name': locked.name,
            },
        )

    bind_map = {}
    for item in bindings or []:
        if not isinstance(item, dict):
            continue
        slot = str(item.get('slotId') or '').strip()
        design_id = str(item.get('designId') or '').strip()
        if not slot or not design_id:
            continue
        revision_id = item.get('revisionId')
        bind_map[slot] = {
            'designId': design_id,
            'revisionId': str(revision_id) if revision_id else None,
        }

    required_slots = list(template.slot_ids or [])
    missing_slots = [s for s in required_slots if s not in bind_map]
    if missing_slots:
        raise RenderSceneError(
            'template slot bindings incomplete',
            code='TEMPLATE_BINDINGS_INCOMPLETE',
            status=400,
            errors={'slotId': missing_slots},
        )

    content = upgrade_scene_to_v2(copy.deepcopy(template.content_json or {}))
    models = []
    for model in content.get('models') or []:
        if not isinstance(model, dict):
            continue
        slot = str(model.get('slotId') or '').strip()
        if slot and slot in bind_map:
            model = {
                **model,
                'id': str(uuid.uuid4()),
                'designId': bind_map[slot]['designId'],
                'revisionId': bind_map[slot]['revisionId'],
            }
        models.append(model)
    content['models'] = models
    content['templateId'] = template.id
    # Keep existing views if template has none
    if not content.get('views'):
        current = locked.content_json if isinstance(locked.content_json, dict) else {}
        content['views'] = copy.deepcopy(current.get('views') or [])

    content = _prepare_content(content)
    assert_designs_in_org(organization_id=locked.organization_id, content=content)
    assert_props_accessible(organization_id=locked.organization_id, content=content)
    assert_environment_valid(content)

    locked.content_json = content
    locked.schema_version = SCHEMA_VERSION
    locked.row_version = F('row_version') + 1
    locked.save(update_fields=['content_json', 'schema_version', 'row_version', 'updated_at'])
    locked.refresh_from_db()
    return locked


def create_user_prop(*, organization, owner, name: str, glb_bytes: bytes) -> RenderProp:
    from apps.assets.services import AssetUploadError, store_prop_glb
    from apps.render_scenes.glb import validate_glb

    meta = validate_glb(glb_bytes)
    try:
        asset = store_prop_glb(
            organization=organization,
            owner=owner,
            data=glb_bytes,
            filename='prop.glb',
            meta=meta,
        )
    except AssetUploadError as exc:
        raise RenderSceneError(str(exc), code=exc.code, status=400) from exc
    return RenderProp.objects.create(
        organization=organization,
        owner=owner,
        name=(name or '我的道具').strip()[:200] or '我的道具',
        source=RenderProp.Source.UPLOAD,
        is_official=False,
        asset=asset,
    )


def delete_user_prop(*, prop: RenderProp, user) -> None:
    if prop.is_official:
        raise RenderSceneError('cannot delete official prop', code='FORBIDDEN', status=403)
    if prop.owner_id != user.id:
        raise RenderSceneError('cannot delete prop', code='FORBIDDEN', status=403)
    prop.delete()


def list_props(*, organization_id, scope: str = 'official'):
    if scope == 'mine':
        return RenderProp.objects.filter(organization_id=organization_id, is_official=False).order_by(
            '-updated_at'
        )
    return RenderProp.objects.filter(is_official=True).order_by('name')
