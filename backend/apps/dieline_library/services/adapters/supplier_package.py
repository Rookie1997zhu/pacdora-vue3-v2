from __future__ import annotations

import json
import tempfile
import zipfile
from pathlib import Path

from apps.dieline_library.models import AcquisitionJob
from apps.dieline_library.services.adapters.base import (
    AdapterError,
    DryRunReport,
    JobResult,
    SourceAdapter,
    ValidationReport,
)
from apps.dieline_library.services.adapters.local_manifest import LocalManifestAdapter
from apps.dieline_library.services.adapters.policy import budget_from_policy, load_policy_dict

FORBIDDEN_SUFFIXES = {'.exe', '.bat', '.cmd', '.ps1', '.sh', '.dll', '.so', '.dylib', '.msi'}


class SupplierPackageAdapter(SourceAdapter):
    adapter_type = 'supplier_package'

    def _package_path(self, plan) -> Path:
        policy = load_policy_dict(plan.policy_json)
        raw = policy.get('package_path') or (plan.spec_plan_json or [{}])[0].get('package_path')
        if not raw:
            raise AdapterError('package_path required', code='PATHS_REQUIRED')
        return Path(raw)

    def validate(self, plan) -> ValidationReport:
        try:
            path = self._package_path(plan)
        except AdapterError as exc:
            return ValidationReport(
                ok=False,
                adapter_type=self.adapter_type,
                errors=[str(exc)],
                block_codes=[exc.code],
            )
        if not path.exists():
            return ValidationReport(
                ok=False,
                adapter_type=self.adapter_type,
                errors=[f'package missing: {path}'],
                block_codes=['PACKAGE_MISSING'],
            )
        if path.is_file() and path.suffix.lower() not in ('.zip',):
            return ValidationReport(
                ok=False,
                adapter_type=self.adapter_type,
                errors=['package must be a directory or .zip'],
                block_codes=['PACKAGE_TYPE'],
            )
        return ValidationReport(
            ok=True,
            adapter_type=self.adapter_type,
            details={'package_path': str(path)},
        )

    def _materialize(self, package: Path) -> tuple[Path, Path, tempfile.TemporaryDirectory | None]:
        """Return (manifest_path, files_root, tempdir_or_None)."""
        if package.is_dir():
            manifest = package / 'manifest.json'
            if not manifest.is_file():
                # JSONL alternative
                jsonl = package / 'manifest.jsonl'
                if jsonl.is_file():
                    manifest = self._jsonl_to_manifest(jsonl, package)
                else:
                    raise AdapterError('manifest.json not found in package', code='MANIFEST_MISSING')
            self._assert_safe_tree(package)
            return manifest, package, None

        if not zipfile.is_zipfile(package):
            raise AdapterError('invalid zip package', code='PACKAGE_INVALID')
        tmp = tempfile.TemporaryDirectory(prefix='dieline_pkg_')
        root = Path(tmp.name)
        with zipfile.ZipFile(package, 'r') as zf:
            for info in zf.infolist():
                name = info.filename.replace('\\', '/')
                if name.startswith('/') or '..' in Path(name).parts:
                    raise AdapterError(f'unsafe zip entry: {name}', code='ZIP_PATH_TRAVERSAL')
                suffix = Path(name).suffix.lower()
                if suffix in FORBIDDEN_SUFFIXES:
                    raise AdapterError(f'forbidden entry: {name}', code='ZIP_FORBIDDEN')
                zf.extract(info, root)
        manifest = root / 'manifest.json'
        if not manifest.is_file():
            jsonl = root / 'manifest.jsonl'
            if jsonl.is_file():
                manifest = self._jsonl_to_manifest(jsonl, root)
            else:
                tmp.cleanup()
                raise AdapterError('manifest.json not found in zip', code='MANIFEST_MISSING')
        return manifest, root, tmp

    def _jsonl_to_manifest(self, jsonl: Path, root: Path) -> Path:
        assets = []
        for line in jsonl.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line:
                continue
            assets.append(json.loads(line))
        out = root / 'manifest.json'
        out.write_text(json.dumps({'provider': 'supplier_package', 'assets': assets}, ensure_ascii=False), encoding='utf-8')
        return out

    def _assert_safe_tree(self, root: Path) -> None:
        for p in root.rglob('*'):
            if p.is_file() and p.suffix.lower() in FORBIDDEN_SUFFIXES:
                raise AdapterError(f'forbidden file: {p.name}', code='PACKAGE_FORBIDDEN')
            try:
                p.resolve().relative_to(root.resolve())
            except ValueError as exc:
                raise AdapterError('path escape detected', code='PATH_TRAVERSAL') from exc

    def _with_local_plan(self, plan, manifest: Path, files_root: Path):
        from apps.dieline_library.models import AcquisitionPlan

        # Transient plan view for LocalManifestAdapter (not saved).
        local = AcquisitionPlan(
            organization=plan.organization,
            adapter_type=AcquisitionPlan.AdapterType.LOCAL_MANIFEST,
            enabled=True,
            policy_json={'manifest_path': str(manifest), 'files_root': str(files_root)},
            spec_plan_json=[],
            budget_json=plan.budget_json or {},
        )
        local._owner = getattr(plan, '_owner', None)
        return local

    def dry_run(self, plan) -> DryRunReport:
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
        package = self._package_path(plan)
        tmp = None
        try:
            manifest, files_root, tmp = self._materialize(package)
            local_plan = self._with_local_plan(plan, manifest, files_root)
            report = LocalManifestAdapter().dry_run(local_plan)
            report.adapter_type = self.adapter_type
            return report
        except AdapterError as exc:
            return DryRunReport(
                adapter_type=self.adapter_type,
                planned_count=0,
                budget_estimate=budget_from_policy(load_policy_dict(plan.policy_json), 0),
                blocked=True,
                block_codes=[exc.code],
                notes=[str(exc)],
            )
        finally:
            if tmp is not None:
                tmp.cleanup()

    def execute(self, job: AcquisitionJob) -> JobResult:
        plan = job.plan
        validation = self.validate(plan)
        if not validation.ok:
            return JobResult(
                status=AcquisitionJob.Status.FAILED,
                error='; '.join(validation.errors),
                error_code=(validation.block_codes or ['VALIDATE_FAILED'])[0],
            )
        package = self._package_path(plan)
        tmp = None
        try:
            manifest, files_root, tmp = self._materialize(package)
            # Mutate plan policy for local adapter for this job run.
            plan.policy_json = {
                **load_policy_dict(plan.policy_json),
                'manifest_path': str(manifest),
                'files_root': str(files_root),
            }
            return LocalManifestAdapter().execute(job)
        except AdapterError as exc:
            return JobResult(status=AcquisitionJob.Status.FAILED, error=str(exc), error_code=exc.code)
        finally:
            if tmp is not None:
                tmp.cleanup()
