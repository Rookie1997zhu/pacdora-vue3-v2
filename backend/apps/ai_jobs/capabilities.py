from __future__ import annotations

from django.conf import settings

from apps.ai_jobs.models import AiJob


IMPLEMENTED = {
    AiJob.Operation.IMAGE_GENERATE,
    AiJob.Operation.MAIN_AREA_GENERATE,
}


def provider_name() -> str:
    return (getattr(settings, 'AI_PROVIDER', 'disabled') or 'disabled').strip().lower()


def api_key() -> str:
    return (getattr(settings, 'AI_API_KEY', '') or '').strip()


def model_name() -> str:
    return (getattr(settings, 'AI_MODEL', '') or '').strip()


def image_generate_available() -> tuple[bool, str]:
    name = provider_name()
    if name in ('', 'disabled'):
        return False, 'provider_disabled'
    if name == 'test':
        # deterministic local provider for tests / DEBUG
        if getattr(settings, 'DEBUG', False) or getattr(settings, 'AI_ALLOW_TEST_PROVIDER', False):
            return True, ''
        return False, 'test_provider_not_allowed'
    if not api_key():
        return False, 'missing_key'
    return True, ''


def mask_input_supported() -> bool:
    """Multimodal mask feed is Gemini-only in P4.3."""
    return provider_name() == 'gemini'


def capability_for(operation: str) -> dict:
    if operation not in IMPLEMENTED:
        return {
            'operation': operation,
            'enabled': False,
            'reason': 'not_implemented',
            'mask_input': False,
        }
    enabled, reason = image_generate_available()
    mask_input = bool(enabled and operation == AiJob.Operation.MAIN_AREA_GENERATE and mask_input_supported())
    return {
        'operation': operation,
        'enabled': enabled,
        'reason': reason or None,
        'provider': provider_name(),
        'model': model_name() or None,
        'mask_input': mask_input,
    }


def list_capabilities() -> dict:
    ops = [c.value for c in AiJob.Operation]
    items = [capability_for(op) for op in ops]
    return {
        'provider': provider_name(),
        'model': model_name() or None,
        'operations': items,
    }


def assert_operation_enabled(operation: str):
    from apps.ai_jobs.errors import AiJobError

    cap = capability_for(operation)
    if not cap.get('enabled'):
        raise AiJobError(
            cap.get('reason') or 'capability unavailable',
            code='CAPABILITY_UNAVAILABLE',
            status=400,
            data=cap,
        )
