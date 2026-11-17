from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.billing.errors import BillingError
from apps.billing.models import ExportGrant, OrganizationEntitlement, UpgradeIntent
from apps.organizations.models import Organization
from apps.organizations.services import ensure_personal_org


def get_or_create_entitlement(organization: Organization) -> OrganizationEntitlement:
    ent, _ = OrganizationEntitlement.objects.get_or_create(organization=organization)
    return ent


def is_annual_active(ent: OrganizationEntitlement, *, now=None) -> bool:
    now = now or timezone.now()
    if ent.plan != OrganizationEntitlement.Plan.ANNUAL:
        return False
    if ent.annual_expires_at is None:
        return False
    return ent.annual_expires_at > now


def remaining_exports(ent: OrganizationEntitlement, *, now=None) -> int | None:
    """None means unlimited (active annual)."""
    if is_annual_active(ent, now=now):
        return None
    left = int(ent.free_export_limit) - int(ent.exports_used)
    return max(0, left)


def can_export(ent: OrganizationEntitlement, *, now=None) -> bool:
    left = remaining_exports(ent, now=now)
    return left is None or left > 0


def serialize_entitlement(ent: OrganizationEntitlement, *, now=None) -> dict:
    now = now or timezone.now()
    annual = is_annual_active(ent, now=now)
    rem = remaining_exports(ent, now=now)
    return {
        'organization_id': str(ent.organization_id),
        'plan': ent.plan,
        'annual_active': annual,
        'annual_expires_at': ent.annual_expires_at.isoformat() if ent.annual_expires_at else None,
        'free_export_limit': ent.free_export_limit,
        'exports_used': ent.exports_used,
        'remaining': rem,
        'unlimited': rem is None,
    }


@transaction.atomic
def consume_export(
    *,
    organization: Organization,
    actor=None,
    reason: str = ExportGrant.Reason.STUDIO_EXPORT,
    format: str = '',
    meta: dict | None = None,
) -> dict:
    ent = (
        OrganizationEntitlement.objects.select_for_update()
        .filter(organization=organization)
        .first()
    )
    if not ent:
        ent = OrganizationEntitlement.objects.create(organization=organization)
        ent = OrganizationEntitlement.objects.select_for_update().get(pk=ent.pk)

    annual = is_annual_active(ent)
    if not annual and not can_export(ent):
        raise BillingError(
            'export quota exceeded',
            code='EXPORT_QUOTA_EXCEEDED',
            status=403,
            data=serialize_entitlement(ent),
        )

    consumed_quota = not annual
    if consumed_quota:
        ent.exports_used = int(ent.exports_used) + 1
        ent.save(update_fields=['exports_used', 'updated_at'])

    grant = ExportGrant.objects.create(
        organization=organization,
        actor=actor if actor and getattr(actor, 'pk', None) else None,
        reason=reason,
        format=(format or '')[:16],
        consumed_quota=consumed_quota,
        meta=meta or {},
    )
    return {
        'grant_id': str(grant.id),
        'consumed_quota': consumed_quota,
        'entitlement': serialize_entitlement(ent),
    }


def entitlement_for_user(user) -> OrganizationEntitlement:
    org = ensure_personal_org(user)
    return get_or_create_entitlement(org)


@transaction.atomic
def refund_export_grant(*, grant_id, organization: Organization | None = None) -> dict | None:
    """Refund a previously consumed export quota (e.g. failed render job)."""
    grant = ExportGrant.objects.select_for_update().filter(id=grant_id).first()
    if not grant:
        return None
    if organization is not None and grant.organization_id != organization.id:
        raise BillingError('grant org mismatch', code='FORBIDDEN', status=403)
    if not grant.consumed_quota:
        return {
            'grant_id': str(grant.id),
            'refunded': False,
            'entitlement': serialize_entitlement(get_or_create_entitlement(grant.organization)),
        }
    meta = dict(grant.meta or {})
    if meta.get('refunded'):
        return {
            'grant_id': str(grant.id),
            'refunded': False,
            'entitlement': serialize_entitlement(get_or_create_entitlement(grant.organization)),
        }
    ent = (
        OrganizationEntitlement.objects.select_for_update()
        .filter(organization_id=grant.organization_id)
        .first()
    )
    if not ent:
        ent = OrganizationEntitlement.objects.create(organization_id=grant.organization_id)
        ent = OrganizationEntitlement.objects.select_for_update().get(pk=ent.pk)
    if int(ent.exports_used) > 0:
        ent.exports_used = int(ent.exports_used) - 1
        ent.save(update_fields=['exports_used', 'updated_at'])
    meta['refunded'] = True
    grant.meta = meta
    grant.consumed_quota = False
    grant.refunded_at = timezone.now()
    grant.save(update_fields=['meta', 'consumed_quota', 'refunded_at'])
    return {
        'grant_id': str(grant.id),
        'refunded': True,
        'entitlement': serialize_entitlement(ent),
    }


@transaction.atomic
def create_upgrade_intent(
    *,
    user,
    plan: str,
    note: str = '',
    contact: str = '',
    organization: Organization | None = None,
) -> UpgradeIntent:
    plan = (plan or '').strip()
    if plan not in UpgradeIntent.PlanChoice.values:
        raise BillingError('invalid plan', code='VALIDATION_ERROR', status=400)
    org = organization or ensure_personal_org(user)
    get_or_create_entitlement(org)
    return UpgradeIntent.objects.create(
        organization=org,
        user=user,
        plan=plan,
        note=(note or '')[:2000],
        contact=(contact or '')[:200],
        status=UpgradeIntent.Status.SUBMITTED,
    )


@transaction.atomic
def patch_entitlement(
    *,
    organization: Organization,
    plan: str | None = None,
    annual_expires_at=None,
    free_export_limit: int | None = None,
    exports_used: int | None = None,
    clear_annual_expires: bool = False,
) -> OrganizationEntitlement:
    ent = get_or_create_entitlement(organization)
    ent = OrganizationEntitlement.objects.select_for_update().get(pk=ent.pk)
    fields = []
    if plan is not None:
        if plan not in OrganizationEntitlement.Plan.values:
            raise BillingError('invalid plan', code='VALIDATION_ERROR', status=400)
        ent.plan = plan
        fields.append('plan')
    if clear_annual_expires:
        ent.annual_expires_at = None
        fields.append('annual_expires_at')
    elif annual_expires_at is not None:
        ent.annual_expires_at = annual_expires_at
        fields.append('annual_expires_at')
    if free_export_limit is not None:
        if free_export_limit < 0:
            raise BillingError('invalid free_export_limit', code='VALIDATION_ERROR', status=400)
        ent.free_export_limit = int(free_export_limit)
        fields.append('free_export_limit')
    if exports_used is not None:
        if exports_used < 0:
            raise BillingError('invalid exports_used', code='VALIDATION_ERROR', status=400)
        ent.exports_used = int(exports_used)
        fields.append('exports_used')
    if not fields:
        raise BillingError('no fields', code='VALIDATION_ERROR', status=400)
    fields.append('updated_at')
    ent.save(update_fields=fields)
    return ent
