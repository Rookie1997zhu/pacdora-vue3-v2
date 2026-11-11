from apps.organizations.models import Membership


def memberships_for(user):
    return Membership.objects.filter(user=user, is_active=True)


def org_ids_for(user):
    return list(memberships_for(user).values_list('organization_id', flat=True))


def require_org_membership(user, organization_id) -> Membership | None:
    return (
        Membership.objects.filter(user=user, organization_id=organization_id, is_active=True)
        .select_related('organization')
        .first()
    )


def primary_org(user):
    m = (
        memberships_for(user)
        .select_related('organization')
        .order_by('created_at')
        .first()
    )
    return m.organization if m else None
