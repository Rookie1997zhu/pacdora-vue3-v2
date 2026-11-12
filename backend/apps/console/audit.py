from __future__ import annotations

from apps.console.models import ConsoleAuditLog


def client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip() or None
    return request.META.get('REMOTE_ADDR') or None


def write_audit(*, request, action: str, target_type: str = '', target_id: str = '', meta=None):
    actor = getattr(request, 'user', None)
    if actor is not None and not getattr(actor, 'is_authenticated', False):
        actor = None
    ConsoleAuditLog.objects.create(
        actor=actor if actor and getattr(actor, 'pk', None) else None,
        action=action,
        target_type=target_type or '',
        target_id=str(target_id or ''),
        meta=meta or {},
        ip=client_ip(request),
    )
