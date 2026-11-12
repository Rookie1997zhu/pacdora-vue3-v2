from __future__ import annotations

from apps.dieline_library.models import AcquisitionItem, AcquisitionJob
from apps.dieline_library.services.adapters.base import (
    AdapterDisabled,
    DryRunReport,
    JobResult,
    SourceAdapter,
    ValidationReport,
)
from apps.dieline_library.services.adapters.packative_runtime import dry_run_packative, run_job
from apps.dieline_library.services.adapters.policy import load_policy_dict, policy_block_codes


class _AuthorizedOnlineAdapter(SourceAdapter):
    """Packative CDN online adapter (REA contract + Scrapy/direct crawl)."""

    def validate(self, plan) -> ValidationReport:
        policy = load_policy_dict(plan.policy_json)
        blocks = policy_block_codes(policy, plan_enabled=bool(plan.enabled))
        warnings = []
        if not policy.get('source_id'):
            warnings.append('source_id missing')
        if not policy.get('contract_id') and not policy.get('contract_path'):
            warnings.append('contract_id missing; default crashlock contract will be used')
        if self.adapter_type == 'authorized_browser':
            warnings.append('authorized_browser uses CDN/API runtime this round (no Playwright)')
        return ValidationReport(
            ok=len(blocks) == 0,
            adapter_type=self.adapter_type,
            errors=[f'blocked:{c}' for c in blocks],
            warnings=warnings,
            block_codes=blocks,
            details={
                'source_id': policy.get('source_id'),
                'enabled': bool(policy.get('enabled')) and bool(plan.enabled),
                'access_review': (policy.get('access_review') or {}).get('status'),
                'contract_id': policy.get('contract_id') or 'packative_cdn_crashlock',
                'runtime': 'packative_cdn',
            },
        )

    def dry_run(self, plan) -> DryRunReport:
        return dry_run_packative(plan, adapter_type=self.adapter_type)

    def execute(self, job: AcquisitionJob) -> JobResult:
        plan = job.plan
        policy = load_policy_dict(plan.policy_json)
        blocks = policy_block_codes(policy, plan_enabled=bool(plan.enabled))
        if blocks:
            code = blocks[0]
            AcquisitionItem.objects.update_or_create(
                job=job,
                external_key='source-gate',
                defaults={
                    'spec_json': {'source_id': policy.get('source_id')},
                    'status': AcquisitionItem.Status.BLOCKED,
                    'failure_code': code,
                    'failure_reason': f'blocked by policy: {",".join(blocks)}',
                    'attempt_count': 1,
                },
            )
            raise AdapterDisabled(
                f'Source adapter blocked: {",".join(blocks)}',
                code=code if code == 'SOURCE_DISABLED' else code,
            )
        return run_job(job)

    def resume(self, job: AcquisitionJob) -> JobResult:
        return self.execute(job)


class AuthorizedBrowserAdapter(_AuthorizedOnlineAdapter):
    adapter_type = 'authorized_browser'


class AuthorizedApiAdapter(_AuthorizedOnlineAdapter):
    adapter_type = 'authorized_api'
