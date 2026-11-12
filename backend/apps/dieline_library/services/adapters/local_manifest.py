from __future__ import annotations

from pathlib import Path

from apps.dieline_library.models import AcquisitionItem, AcquisitionJob
from apps.dieline_library.services.adapters.base import (
    AdapterError,
    DryRunReport,
    JobResult,
    SourceAdapter,
    ValidationReport,
)
from apps.dieline_library.services.adapters.policy import budget_from_policy, load_policy_dict
from apps.dieline_library.services.import_manifest import ImportManifestError, import_local_manifest


class LocalManifestAdapter(SourceAdapter):
    adapter_type = 'local_manifest'

    def _paths(self, plan) -> tuple[Path, Path]:
        policy = load_policy_dict(plan.policy_json)
        manifest = policy.get('manifest_path') or (plan.spec_plan_json or [{}])[0].get('manifest_path')
        files_root = policy.get('files_root') or (plan.spec_plan_json or [{}])[0].get('files_root')
        if not manifest or not files_root:
            raise AdapterError('manifest_path and files_root required', code='PATHS_REQUIRED')
        return Path(manifest), Path(files_root)

    def validate(self, plan) -> ValidationReport:
        errors: list[str] = []
        try:
            manifest, files_root = self._paths(plan)
        except AdapterError as exc:
            return ValidationReport(
                ok=False,
                adapter_type=self.adapter_type,
                errors=[str(exc)],
                block_codes=[exc.code],
            )
        if not manifest.is_file():
            errors.append(f'manifest missing: {manifest}')
        if not files_root.is_dir():
            errors.append(f'files_root missing: {files_root}')
        return ValidationReport(
            ok=not errors,
            adapter_type=self.adapter_type,
            errors=errors,
            details={'manifest_path': str(manifest), 'files_root': str(files_root)},
        )

    def dry_run(self, plan) -> DryRunReport:
        owner = getattr(plan, '_owner', None)
        if owner is None:
            return DryRunReport(
                adapter_type=self.adapter_type,
                planned_count=0,
                budget_estimate=budget_from_policy(load_policy_dict(plan.policy_json), 0),
                blocked=True,
                block_codes=['OWNER_REQUIRED'],
                notes=['dry_run requires plan._owner'],
            )
        validation = self.validate(plan)
        if not validation.ok:
            return DryRunReport(
                adapter_type=self.adapter_type,
                planned_count=0,
                budget_estimate=budget_from_policy(load_policy_dict(plan.policy_json), 0),
                blocked=True,
                block_codes=validation.block_codes or ['VALIDATE_FAILED'],
                notes=validation.errors,
            )
        manifest, files_root = self._paths(plan)
        try:
            report = import_local_manifest(
                organization=plan.organization,
                owner=owner,
                manifest_path=manifest,
                files_root=files_root,
                dry_run=True,
            )
        except ImportManifestError as exc:
            return DryRunReport(
                adapter_type=self.adapter_type,
                planned_count=0,
                budget_estimate=budget_from_policy(load_policy_dict(plan.policy_json), 0),
                blocked=True,
                block_codes=[exc.code],
                notes=[str(exc)],
            )
        planned = len(report.items)
        return DryRunReport(
            adapter_type=self.adapter_type,
            planned_count=planned,
            budget_estimate=budget_from_policy(load_policy_dict(plan.policy_json), planned),
            items=[
                {
                    'path': i.path,
                    'status': i.status,
                    'detail': i.detail,
                    'idempotency_key': i.idempotency_key,
                }
                for i in report.items
            ],
        )

    def execute(self, job: AcquisitionJob) -> JobResult:
        plan = job.plan
        validation = self.validate(plan)
        if not validation.ok:
            return JobResult(
                status=AcquisitionJob.Status.FAILED,
                error='; '.join(validation.errors),
                error_code=(validation.block_codes or ['VALIDATE_FAILED'])[0],
            )
        owner_id = job.created_by_id
        if not owner_id:
            return JobResult(
                status=AcquisitionJob.Status.FAILED,
                error='job missing created_by_id',
                error_code='OWNER_REQUIRED',
            )
        from apps.accounts.models import User

        owner = User.objects.filter(id=owner_id).first()
        if not owner:
            return JobResult(
                status=AcquisitionJob.Status.FAILED,
                error='owner not found',
                error_code='OWNER_MISSING',
            )

        manifest, files_root = self._paths(plan)
        cursor = dict(job.cursor_json or {})
        start_index = int(cursor.get('next_index') or 0)

        try:
            report = import_local_manifest(
                organization=job.organization,
                owner=owner,
                manifest_path=manifest,
                files_root=files_root,
                dry_run=bool(job.dry_run),
            )
        except ImportManifestError as exc:
            return JobResult(status=AcquisitionJob.Status.FAILED, error=str(exc), error_code=exc.code)

        stats = {
            'planned': len(report.items),
            'succeeded': 0,
            'failed': 0,
            'skipped': 0,
            'bytes': 0,
            'dry_run': bool(job.dry_run),
        }

        for idx, item in enumerate(report.items):
            if idx < start_index:
                continue
            external_key = item.idempotency_key or f'{item.path}:{idx}'
            acq_item, _ = AcquisitionItem.objects.get_or_create(
                job=job,
                external_key=external_key[:255],
                defaults={'spec_json': {'path': item.path, 'index': idx}},
            )
            acq_item.attempt_count = (acq_item.attempt_count or 0) + 1
            if item.status == 'created':
                acq_item.status = AcquisitionItem.Status.SUCCEEDED
                acq_item.failure_reason = ''
                acq_item.failure_code = ''
                if item.revision_id:
                    from apps.dieline_library.models import ImmutableRevision

                    acq_item.revision_id = item.revision_id
                stats['succeeded'] += 1
            elif item.status in ('skipped', 'would_skip'):
                acq_item.status = AcquisitionItem.Status.SKIPPED
                acq_item.failure_reason = item.detail or ''
                stats['skipped'] += 1
            elif item.status == 'would_create':
                acq_item.status = AcquisitionItem.Status.SUCCEEDED
                acq_item.failure_reason = item.detail or 'dry_run'
                stats['succeeded'] += 1
            else:
                acq_item.status = AcquisitionItem.Status.FAILED
                acq_item.failure_reason = item.detail or item.status
                acq_item.failure_code = 'IMPORT_ITEM_FAILED'
                stats['failed'] += 1
            acq_item.save()
            cursor['next_index'] = idx + 1

        if stats['failed'] and not stats['succeeded'] and not stats['skipped']:
            status = AcquisitionJob.Status.FAILED
        elif stats['failed']:
            status = AcquisitionJob.Status.SUCCEEDED  # partial ok; failures recorded on items
        else:
            status = AcquisitionJob.Status.SUCCEEDED
        return JobResult(status=status, stats=stats, cursor=cursor)
