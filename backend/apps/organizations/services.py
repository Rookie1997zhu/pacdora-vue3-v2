from __future__ import annotations

import re
import uuid

from django.db import transaction
from django.utils.text import slugify

from apps.organizations.models import Membership, Organization


def _unique_slug(base: str) -> str:
    root = slugify(base) or 'org'
    root = re.sub(r'[^a-z0-9-]+', '-', root).strip('-')[:120] or 'org'
    candidate = root
    while Organization.objects.filter(slug=candidate).exists():
        candidate = f'{root}-{uuid.uuid4().hex[:6]}'
    return candidate


@transaction.atomic
def ensure_personal_org(user) -> Organization:
    existing = (
        Membership.objects.filter(user=user, role=Membership.Role.OWNER, is_active=True)
        .select_related('organization')
        .first()
    )
    if existing:
        return existing.organization
    name = f"{user.display_name or user.email.split('@')[0]} 的工作区"
    org = Organization.objects.create(name=name, slug=_unique_slug(f'user-{user.id.hex[:8]}'))
    Membership.objects.create(
        organization=org,
        user=user,
        role=Membership.Role.OWNER,
        is_active=True,
    )
    return org


def user_has_org_access(user, organization_id) -> bool:
    return Membership.objects.filter(
        user=user,
        organization_id=organization_id,
        is_active=True,
    ).exists()
