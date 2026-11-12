from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


class AdapterError(Exception):
    def __init__(self, message: str, code: str = 'ADAPTER_ERROR'):
        super().__init__(message)
        self.code = code


class AdapterDisabled(AdapterError):
    def __init__(self, message: str = 'Source adapter disabled', code: str = 'SOURCE_DISABLED'):
        super().__init__(message, code=code)


@dataclass
class ValidationReport:
    ok: bool
    adapter_type: str
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    block_codes: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            'ok': self.ok,
            'adapter_type': self.adapter_type,
            'errors': self.errors,
            'warnings': self.warnings,
            'block_codes': self.block_codes,
            'details': self.details,
        }


@dataclass
class DryRunReport:
    adapter_type: str
    planned_count: int
    budget_estimate: dict[str, Any]
    blocked: bool = False
    block_codes: list[str] = field(default_factory=list)
    items: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            'adapter_type': self.adapter_type,
            'planned_count': self.planned_count,
            'budget_estimate': self.budget_estimate,
            'blocked': self.blocked,
            'block_codes': self.block_codes,
            'items': self.items,
            'notes': self.notes,
        }


@dataclass
class JobResult:
    status: str
    stats: dict[str, Any] = field(default_factory=dict)
    error: str = ''
    error_code: str = ''
    cursor: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            'status': self.status,
            'stats': self.stats,
            'error': self.error,
            'error_code': self.error_code,
            'cursor': self.cursor,
        }


class SourceAdapter(ABC):
    adapter_type: str = ''

    @abstractmethod
    def validate(self, plan) -> ValidationReport:
        raise NotImplementedError

    @abstractmethod
    def dry_run(self, plan) -> DryRunReport:
        raise NotImplementedError

    @abstractmethod
    def execute(self, job) -> JobResult:
        raise NotImplementedError

    def resume(self, job) -> JobResult:
        return self.execute(job)
