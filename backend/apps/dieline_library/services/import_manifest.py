from __future__ import annotations

import hashlib
import json
import mimetypes
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.dieline_library.models import (
    AssetVariant,
    DielineFamily,
    ImmutableRevision,
    SourceProvider,
    SourceTemplate,
    UsageGrant,
)
from apps.dieline_library.storage import store_dieline_bytes
from apps.dieline_library.svg_sanitize import SvgSanitizeError, looks_like_html_login_page, sanitize_svg_bytes


class ImportManifestError(Exception):
    def __init__(self, message: str, code: str = 'IMPORT_ERROR'):
        super().__init__(message)
        self.code = code


@dataclass
class ImportItemResult:
    path: str
    status: str
    detail: str = ''
    revision_id: str | None = None
    idempotency_key: str | None = None


@dataclass
class ImportReport:
    dry_run: bool
    items: list[ImportItemResult] = field(default_factory=list)
    created_revisions: int = 0
    skipped: int = 0
    failed: int = 0

    def to_dict(self):
        return {
            'dry_run': self.dry_run,
            'created_revisions': self.created_revisions,
            'skipped': self.skipped,
            'failed': self.failed,
            'items': [
                {
                    'path': i.path,
                    'status': i.status,
                    'detail': i.detail,
                    'revision_id': i.revision_id,
                    'idempotency_key': i.idempotency_key,
                }
                for i in self.items
            ],
        }


def _dec(value) -> Decimal | None:
    if value is None or value == '':
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _guess_mime(path: Path) -> str:
    by_suffix = {
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.dxf': 'application/dxf',
    }
    return by_suffix.get(path.suffix.lower()) or (mimetypes.guess_type(path.name)[0] or 'application/octet-stream')


def _format_from_mime(mime: str) -> str:
    return {
        'image/svg+xml': 'svg',
        'application/pdf': 'pdf',
        'application/dxf': 'dxf',
    }.get(mime, 'unknown')


def _idempotency_key(*, org_id, template_key: str, dims: tuple, sha256: str) -> str:
    l, w, h = dims
    return f'{org_id}:{template_key}:{l}:{w}:{h}:{sha256}'


def import_local_manifest(
    *,
    organization,
    owner,
    manifest_path: Path,
    files_root: Path,
    dry_run: bool = False,
) -> ImportReport:
    manifest_path = Path(manifest_path)
    files_root = Path(files_root)
    if not manifest_path.is_file():
        raise ImportManifestError('manifest not found', code='MANIFEST_MISSING')
    if not files_root.is_dir():
        raise ImportManifestError('files root not found', code='FILES_ROOT_MISSING')

    raw = json.loads(manifest_path.read_text(encoding='utf-8'))
    if not isinstance(raw, dict):
        raise ImportManifestError('manifest must be an object', code='MANIFEST_INVALID')

    is_example = bool(raw.get('is_example', False))
    entries = raw.get('assets') or raw.get('items') or []
    if isinstance(raw.get('files'), list) and not entries:
        # Single-asset compact form
        entries = [raw]
    if not isinstance(entries, list) or not entries:
        raise ImportManifestError('manifest has no assets', code='MANIFEST_EMPTY')

    report = ImportReport(dry_run=dry_run)
    provider_code = str((raw.get('source') or {}).get('source_id') or raw.get('provider') or 'local_manifest')

    for entry in entries:
        if not isinstance(entry, dict):
            report.failed += 1
            report.items.append(ImportItemResult(path='?', status='failed', detail='entry not object'))
            continue
        try:
            item = _import_one(
                organization=organization,
                owner=owner,
                provider_code=provider_code,
                entry=entry,
                files_root=files_root,
                force_example=is_example or bool(entry.get('is_example')),
                dry_run=dry_run,
            )
            report.items.append(item)
            if item.status == 'created':
                report.created_revisions += 1
            elif item.status == 'skipped':
                report.skipped += 1
            else:
                report.failed += 1
        except Exception as exc:  # noqa: BLE001
            report.failed += 1
            report.items.append(
                ImportItemResult(
                    path=str((entry.get('files') or [{}])[0].get('path') or entry.get('path') or '?'),
                    status='failed',
                    detail=str(exc),
                )
            )
    return report


def _import_one(
    *,
    organization,
    owner,
    provider_code: str,
    entry: dict,
    files_root: Path,
    force_example: bool,
    dry_run: bool,
) -> ImportItemResult:
    files = entry.get('files') or []
    if entry.get('path'):
        files = [{'path': entry['path'], 'mime': entry.get('mime')}]
    if not files:
        raise ImportManifestError('asset entry missing files', code='NO_FILES')
    file_meta = files[0]
    rel = str(file_meta.get('path') or '')
    if not rel or '..' in Path(rel).parts:
        raise ImportManifestError('unsafe file path', code='BAD_PATH')
    abs_file = (files_root / rel).resolve()
    root_resolved = files_root.resolve()
    if not str(abs_file).startswith(str(root_resolved)) or not abs_file.is_file():
        raise ImportManifestError(f'file missing: {rel}', code='FILE_MISSING')

    data = abs_file.read_bytes()
    if not data:
        raise ImportManifestError('empty file', code='EMPTY_FILE')
    mime = (file_meta.get('mime') or _guess_mime(abs_file)).lower()
    sha256 = hashlib.sha256(data).hexdigest()

    dims_obj = entry.get('dimensions') or {}
    length_mm = _dec(dims_obj.get('length_mm') if dims_obj else entry.get('length_mm'))
    width_mm = _dec(dims_obj.get('width_mm') if dims_obj else entry.get('width_mm'))
    height_mm = _dec(dims_obj.get('height_mm') if dims_obj else entry.get('height_mm'))
    basis = str(dims_obj.get('basis') or entry.get('dimension_basis') or 'unknown').lower()
    if basis not in ('inner', 'outer', 'unknown'):
        basis = 'unknown'

    title = entry.get('title') or {}
    title_zh = (title.get('zh') if isinstance(title, dict) else None) or entry.get('title_zh') or abs_file.stem
    title_ko = (title.get('ko') if isinstance(title, dict) else None) or entry.get('title_ko') or ''

    template_id = str(
        entry.get('source_template_id')
        or (entry.get('source') or {}).get('source_record_id')
        or entry.get('family_id')
        or 'local'
    )
    template_rev = str(entry.get('template_revision') or '1')
    idem = _idempotency_key(
        org_id=organization.id,
        template_key=f'{template_id}@{template_rev}',
        dims=(str(length_mm), str(width_mm), str(height_mm)),
        sha256=sha256,
    )

    acquisition = ImmutableRevision.AcquisitionStatus.UNPROCESSED
    preview_bytes = None
    detail = ''
    if mime == 'image/svg+xml':
        if looks_like_html_login_page(data):
            acquisition = ImmutableRevision.AcquisitionStatus.NEEDS_REVIEW
            detail = 'pseudo_svg_html'
        else:
            try:
                preview_bytes = sanitize_svg_bytes(data)
                acquisition = ImmutableRevision.AcquisitionStatus.OK
            except SvgSanitizeError as exc:
                acquisition = ImmutableRevision.AcquisitionStatus.NEEDS_REVIEW
                detail = exc.code
    elif mime in ('application/pdf', 'application/dxf'):
        acquisition = ImmutableRevision.AcquisitionStatus.OK
        detail = 'original_only_preview_unavailable'
    else:
        raise ImportManifestError(f'unsupported mime {mime}', code='UNSUPPORTED_MIME')

    rights = entry.get('rights') or {}
    perms = rights.get('permissions') or {}
    quality = entry.get('quality') or {}
    publication = str(quality.get('publication_status') or entry.get('publication_status') or 'draft')
    if publication not in ('draft', 'review', 'published', 'revoked'):
        publication = 'draft'
    rights_status = str(rights.get('grant_status') or 'pending')
    if rights_status not in ('pending', 'granted', 'denied', 'expired'):
        rights_status = 'pending'
    mfg = str(quality.get('manufacturing_status') or 'reference_only')
    if mfg not in ('reference_only', 'unverified', 'sample_ok', 'production_ok'):
        mfg = 'reference_only'

    if dry_run:
        return ImportItemResult(
            path=rel,
            status='would_create' if not ImmutableRevision.objects.filter(idempotency_key=idem).exists() else 'would_skip',
            detail=detail or 'ok',
            idempotency_key=idem,
        )

    with transaction.atomic():
        existing = ImmutableRevision.objects.filter(idempotency_key=idem).select_related('variant').first()
        if existing:
            return ImportItemResult(
                path=rel,
                status='skipped',
                detail='idempotent_hit',
                revision_id=str(existing.id),
                idempotency_key=idem,
            )

        provider, _ = SourceProvider.objects.get_or_create(
            organization=organization,
            code=provider_code[:64],
            defaults={'title': provider_code, 'enabled': True},
        )
        source_template, _ = SourceTemplate.objects.get_or_create(
            provider=provider,
            external_id=template_id[:200],
            version=template_rev[:64],
            defaults={'title': title_zh[:200]},
        )
        family_name = str(entry.get('family_name') or title_zh or 'Imported')[:200]
        family, _ = DielineFamily.objects.get_or_create(
            organization=organization,
            name_zh=family_name,
            defaults={'name_ko': title_ko[:200], 'category': str(entry.get('category') or 'general')[:80]},
        )
        material = entry.get('material') or {}
        variant = AssetVariant.objects.create(
            organization=organization,
            family=family,
            source_template=source_template,
            title_zh=str(title_zh)[:200],
            title_ko=str(title_ko or '')[:200],
            length_mm=length_mm,
            width_mm=width_mm,
            height_mm=height_mm,
            dimension_basis=basis,
            material_name=str(material.get('name') or entry.get('material_name') or '')[:120],
            thickness_mm=_dec(material.get('thickness_mm') if isinstance(material, dict) else None),
            is_example=force_example,
        )
        asset = store_dieline_bytes(
            organization=organization,
            owner=owner,
            data=data,
            mime=mime,
            filename=abs_file.name,
            meta={'import_path': rel, 'is_example': force_example},
        )
        preview_asset = None
        if preview_bytes and acquisition == ImmutableRevision.AcquisitionStatus.OK:
            preview_asset = store_dieline_bytes(
                organization=organization,
                owner=owner,
                data=preview_bytes,
                mime='image/svg+xml',
                filename=f'preview-{abs_file.stem}.svg',
                meta={'kind': 'safe_preview', 'parent_sha256': sha256},
            )

        captured_raw = (entry.get('source') or {}).get('captured_at') or entry.get('captured_at')
        captured_at = parse_datetime(str(captured_raw)) if captured_raw else timezone.now()
        if captured_at and timezone.is_naive(captured_at):
            captured_at = timezone.make_aware(captured_at, timezone.get_current_timezone())

        revision = ImmutableRevision.objects.create(
            variant=variant,
            revision_no=1,
            asset=asset,
            sha256=sha256,
            format=_format_from_mime(mime),
            original_filename=abs_file.name[:255],
            captured_at=captured_at,
            acquisition_status=acquisition,
            rights_status=rights_status,
            manufacturing_status=mfg,
            publication_status=publication,
            preview_asset=preview_asset,
            idempotency_key=idem,
            notes=detail,
        )
        UsageGrant.objects.create(
            revision=revision,
            can_store=bool(perms.get('can_store', True)),
            can_transform=bool(perms.get('can_transform', False)),
            can_use_internally=bool(perms.get('can_use_internally', True)),
            can_use_commercially=bool(perms.get('can_use_commercially', False)),
            can_show_public_preview=bool(perms.get('can_show_public_preview', False)),
            can_redistribute_files=bool(perms.get('can_redistribute_files', False)),
            attribution=str(rights.get('attribution') or '')[:255],
        )
        return ImportItemResult(
            path=rel,
            status='created',
            detail=detail or 'ok',
            revision_id=str(revision.id),
            idempotency_key=idem,
        )
