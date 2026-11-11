from __future__ import annotations

import copy
import uuid

from django.db import transaction
from django.utils import timezone

from apps.assets.models import Asset, AssetReference
from apps.catalog.models import TemplateDefinition, TemplateVersion
from apps.designs.document import DocumentValidationError, content_hash, request_hash, validate_design_document
from apps.designs.models import Design, DesignRevision, IdempotencyRecord, OutboxEvent
from apps.geometry_api.client import GeometryServiceError, validate_geometry


class DesignServiceError(Exception):
    def __init__(self, message, *, code='DESIGN_ERROR', status=400, errors=None, data=None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.errors = errors or {}
        self.data = data


def _collect_asset_ids(content: dict) -> set[str]:
    ids = set()
    for layer in content.get('artwork', {}).get('layers') or []:
        aid = layer.get('assetId')
        if aid:
            ids.add(str(aid))
    src = content.get('geometry', {}).get('sourceAssetId')
    if src:
        ids.add(str(src))
    return ids


def assert_assets_usable(organization_id, content: dict):
    asset_ids = _collect_asset_ids(content)
    if not asset_ids:
        return
    assets = {
        str(a.id): a
        for a in Asset.objects.filter(id__in=asset_ids, organization_id=organization_id)
    }
    missing = [aid for aid in asset_ids if aid not in assets]
    if missing:
        raise DesignServiceError(
            'asset not found in organization',
            code='ASSET_NOT_FOUND',
            status=400,
            errors={'assetId': missing},
        )
    not_ready = [aid for aid, a in assets.items() if a.status != Asset.Status.READY]
    if not_ready:
        raise DesignServiceError(
            'asset not ready',
            code='ASSET_NOT_READY',
            status=400,
            errors={'assetId': not_ready},
        )


def resolve_template(template_id: str) -> tuple[TemplateDefinition, TemplateVersion]:
    try:
        tpl = TemplateDefinition.objects.get(template_key=template_id)
    except TemplateDefinition.DoesNotExist as exc:
        raise DesignServiceError('unknown template_id', code='UNKNOWN_TEMPLATE', status=400) from exc
    ver = tpl.versions.filter(is_current=True).order_by('-created_at').first()
    if not ver:
        raise DesignServiceError('template has no current version', code='TEMPLATE_VERSION_MISSING', status=400)
    return tpl, ver


_PARAM_LIMIT_FIELDS = (
    ('lengthMm', 'length', 'length_mm'),
    ('widthMm', 'width', 'width_mm'),
    ('heightMm', 'height', 'height_mm'),
)


def _assert_parametric_limits(version: TemplateVersion, params: dict) -> None:
    """Reject out-of-range L/W/H using seed TemplateVersion.limits before geometry HTTP."""
    limits = version.limits or {}
    if not isinstance(limits, dict) or not limits:
        return
    for param_key, limit_key, field_label in _PARAM_LIMIT_FIELDS:
        range_ = limits.get(limit_key)
        if not (isinstance(range_, (list, tuple)) and len(range_) == 2):
            continue
        try:
            lo = float(range_[0])
            hi = float(range_[1])
            val = float(params.get(param_key))
        except (TypeError, ValueError) as exc:
            raise DesignServiceError(
                f'{field_label} invalid',
                code='OUT_OF_RANGE',
                status=400,
                errors={'field': field_label, 'range': list(range_)},
            ) from exc
        if val < lo or val > hi:
            raise DesignServiceError(
                f'{field_label} out of range [{range_[0]}, {range_[1]}]',
                code='OUT_OF_RANGE',
                status=400,
                errors={'field': field_label, 'range': [range_[0], range_[1]]},
            )


def apply_server_geometry(content: dict, template: TemplateDefinition, version: TemplateVersion) -> dict:
    content = copy.deepcopy(content)
    geom = content['geometry']
    if template.geometry_mode == TemplateDefinition.GeometryMode.MODEL_ONLY:
        geom['geometryHash'] = f"model_only:{template.template_key}:{version.version}"
        geom['templateVersion'] = version.version
        geom['engineVersion'] = version.engine_version
        geom['mode'] = template.geometry_mode
        return content

    params = geom['params']
    if template.geometry_mode == TemplateDefinition.GeometryMode.FIXED_SNAPSHOT:
        locked = (version.param_schema or {}).get('locked_dims') or {}
        for field in ('lengthMm', 'widthMm', 'heightMm'):
            expected = locked.get(field)
            if expected is None:
                continue
            try:
                actual = float(params.get(field))
                expect_f = float(expected)
            except (TypeError, ValueError) as exc:
                raise DesignServiceError(
                    'fixed_snapshot size must match locked_dims',
                    code='SIZE_LOCKED',
                    status=400,
                    errors={field: ['invalid']},
                ) from exc
            if abs(actual - expect_f) > 0.01:
                raise DesignServiceError(
                    'fixed_snapshot size is locked; length/width/height must match catalog',
                    code='SIZE_LOCKED',
                    status=400,
                    errors={
                        field: [f'expected {expect_f}, got {actual}'],
                        'locked_dims': locked,
                    },
                )
        geom['mode'] = template.geometry_mode
        geom['templateVersion'] = version.version
        geom['engineVersion'] = version.engine_version
        geom['geometryHash'] = (
            f"fixed:{template.template_key}:{params['lengthMm']}x{params['widthMm']}x{params['heightMm']}"
        )
        return content

    _assert_parametric_limits(version, params)

    try:
        result = validate_geometry(
            {
                'template_id': template.template_key,
                'length_mm': params['lengthMm'],
                'width_mm': params['widthMm'],
                'height_mm': params['heightMm'],
                'thickness_mm': params['thicknessMm'],
                'bleed_mm': params['bleedInputMm'],
                'size_mode': params['sizeMode'],
            }
        )
    except GeometryServiceError as exc:
        raise DesignServiceError(str(exc), code=exc.code, status=exc.status_code, errors=exc.payload) from exc

    geom['mode'] = template.geometry_mode
    geom['templateId'] = template.template_key
    geom['templateVersion'] = version.version
    geom['engineVersion'] = version.engine_version
    geom['geometryHash'] = result.get('geometry_hash') or (
        f"{template.template_key}:{params['lengthMm']}x{params['widthMm']}x{params['heightMm']}"
    )
    return content


def create_design(*, organization, owner, name, product=None, initial_content=None) -> Design:
    design = Design.objects.create(
        organization=organization,
        owner=owner,
        product=product,
        name=name or '未命名设计',
        status=Design.Status.ACTIVE,
        row_version=1,
    )
    if initial_content is not None:
        save_revision(
            design=design,
            user=owner,
            content=initial_content,
            expected_row_version=1,
            idempotency_key=f'bootstrap-{design.id}',
        )
        design.refresh_from_db()
    return design


def save_revision(*, design: Design, user, content: dict, expected_row_version: int, idempotency_key: str | None):
    if design.status != Design.Status.ACTIVE:
        raise DesignServiceError('design archived', code='DESIGN_ARCHIVED', status=400)

    payload_for_hash = {
        'expected_row_version': expected_row_version,
        'content': content,
    }
    req_hash = request_hash(payload_for_hash)

    if idempotency_key:
        existing = IdempotencyRecord.objects.filter(
            organization_id=design.organization_id,
            key=idempotency_key,
        ).first()
        if existing:
            if existing.request_hash != req_hash:
                raise DesignServiceError(
                    'idempotency key reuse with different payload',
                    code='IDEMPOTENCY_CONFLICT',
                    status=409,
                )
            return existing.response_json, existing.http_status, True

    try:
        validate_design_document(content)
    except DocumentValidationError as exc:
        raise DesignServiceError(str(exc), code='VALIDATION_ERROR', status=400, errors=exc.errors) from exc

    template_id = content['geometry']['templateId']
    template, version = resolve_template(template_id)
    assert_assets_usable(design.organization_id, content)
    content = apply_server_geometry(content, template, version)
    content['designId'] = str(design.id)
    content['schemaVersion'] = 'boxcraft.design.v1'

    with transaction.atomic():
        locked = Design.objects.select_for_update().get(pk=design.pk)
        if locked.row_version != expected_row_version:
            raise DesignServiceError(
                '设计已在其他窗口更新',
                code='DESIGN_VERSION_CONFLICT',
                status=409,
                errors={'expected_row_version': ['stale']},
                data={
                    'row_version': locked.row_version,
                    'current_revision_id': str(locked.current_revision_id) if locked.current_revision_id else None,
                },
            )
        next_no = (locked.revisions.order_by('-revision_no').values_list('revision_no', flat=True).first() or 0) + 1
        rev = DesignRevision.objects.create(
            design=locked,
            revision_no=next_no,
            schema_version='boxcraft.design.v1',
            content_json=content,
            content_hash=content_hash(content),
            geometry_hash=content['geometry']['geometryHash'],
            template_version=version.version,
            engine_version=version.engine_version,
            creator=user,
        )
        locked.current_revision = rev
        locked.row_version = locked.row_version + 1
        locked.updated_at = timezone.now()
        locked.save(update_fields=['current_revision', 'row_version', 'updated_at'])

        for aid in _collect_asset_ids(content):
            AssetReference.objects.get_or_create(
                asset_id=aid,
                ref_type='design_revision',
                ref_id=str(rev.id),
            )

        OutboxEvent.objects.create(
            event_type='design.revision_created',
            payload={
                'design_id': str(locked.id),
                'revision_id': str(rev.id),
                'revision_no': rev.revision_no,
                'organization_id': str(locked.organization_id),
            },
        )

        response = {
            'design_id': str(locked.id),
            'row_version': locked.row_version,
            'revision': {
                'id': str(rev.id),
                'revision_no': rev.revision_no,
                'content_hash': rev.content_hash,
                'geometry_hash': rev.geometry_hash,
                'created_at': rev.created_at.isoformat(),
            },
            'content': content,
        }
        if idempotency_key:
            IdempotencyRecord.objects.create(
                organization_id=locked.organization_id,
                key=idempotency_key,
                request_hash=req_hash,
                response_json=response,
                http_status=201,
            )

        from apps.assets.services import enqueue_missing_thumbnails_for_content

        # Non-blocking for async workers; eager mode may run sync after commit via on_commit.
        transaction.on_commit(lambda c=content: enqueue_missing_thumbnails_for_content(c))
        return response, 201, False


def copy_design(*, source: Design, user, name: str | None = None) -> Design:
    content = None
    if source.current_revision_id:
        content = copy.deepcopy(source.current_revision.content_json)
    new_design = Design.objects.create(
        organization=source.organization,
        owner=user,
        product=source.product,
        name=name or f'{source.name} 副本',
        status=Design.Status.ACTIVE,
        row_version=1,
    )
    if content is not None:
        content['designId'] = str(new_design.id)
        save_revision(
            design=new_design,
            user=user,
            content=content,
            expected_row_version=1,
            idempotency_key=f'copy-{new_design.id}',
        )
        new_design.refresh_from_db()
    return new_design
