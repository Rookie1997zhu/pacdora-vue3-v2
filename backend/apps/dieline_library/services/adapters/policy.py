from __future__ import annotations

from pathlib import Path
from typing import Any


def load_policy_dict(policy: dict | None) -> dict[str, Any]:
    if not isinstance(policy, dict):
        return {}
    return dict(policy)


def policy_block_codes(policy: dict[str, Any], *, plan_enabled: bool) -> list[str]:
    codes: list[str] = []
    # Project policy: online sources default enabled unless explicitly false.
    enabled = bool(policy.get('enabled', True)) and bool(plan_enabled)
    if not enabled:
        codes.append('SOURCE_DISABLED')

    review = policy.get('access_review') or {}
    grant = policy.get('grant') or {}
    perpetual = bool(review.get('perpetual')) or bool(grant.get('perpetual'))
    status = str(review.get('status') or ('approved' if perpetual else 'pending'))
    if status != 'approved' and not perpetual:
        codes.append('RIGHTS_EVIDENCE_MISSING')

    perms = policy.get('permissions') or {}
    # Default open: missing flag means collect allowed; explicit false still blocks.
    can_collect = perms.get('can_collect_automatically')
    if can_collect is None:
        can_collect = True
    if not bool(can_collect):
        codes.append('AUTO_COLLECT_FORBIDDEN')

    return codes


def budget_from_policy(policy: dict[str, Any], planned_count: int) -> dict[str, Any]:
    execution = policy.get('execution') or {}
    max_jobs = int(execution.get('max_jobs') or planned_count or 0)
    return {
        'planned_count': planned_count,
        'max_jobs': max_jobs,
        'max_total_requests': int(execution.get('max_total_requests') or 0),
        'max_total_bytes': int(execution.get('max_total_bytes') or 0),
        'concurrency': int(execution.get('concurrency') or 1),
        'min_seconds_between_jobs': int(execution.get('min_seconds_between_jobs') or 0),
        'allow_billable_actions': bool(execution.get('allow_billable_actions', False)),
    }


def default_packative_policy_path() -> Path:
    return Path(__file__).resolve().parents[2] / 'fixtures' / 'source_policies' / 'packative.default.json'


def disabled_packative_policy_path() -> Path:
    return Path(__file__).resolve().parents[2] / 'fixtures' / 'source_policies' / 'packative.disabled.json'
