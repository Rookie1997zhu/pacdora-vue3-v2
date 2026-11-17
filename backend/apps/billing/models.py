from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.organizations.models import Organization


class OrganizationEntitlement(models.Model):
    class Plan(models.TextChoices):
        FREE = 'free', 'Free'
        ANNUAL = 'annual', 'Annual'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name='entitlement',
    )
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.FREE)
    free_export_limit = models.PositiveIntegerField(default=10)
    exports_used = models.PositiveIntegerField(default=0)
    annual_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['plan', 'annual_expires_at'])]

    def __str__(self):
        return f'{self.organization_id}:{self.plan}:{self.exports_used}/{self.free_export_limit}'


class ExportGrant(models.Model):
    """One consumed export authorization (Studio job or Lab client download)."""

    class Reason(models.TextChoices):
        STUDIO_EXPORT = 'studio_export', 'Studio export'
        WORKBENCH_EXPORT = 'workbench_export', 'Workbench export'
        LAB_CLIENT = 'lab_client', 'Lab client download'
        RENDER_EXPORT = 'render_export', 'Render export'
        MANUAL = 'manual', 'Manual'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='export_grants')
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='export_grants',
    )
    reason = models.CharField(max_length=40, choices=Reason.choices)
    format = models.CharField(max_length=16, blank=True)
    consumed_quota = models.BooleanField(default=True)
    meta = models.JSONField(default=dict, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['organization', '-created_at'])]


class UpgradeIntent(models.Model):
    class PlanChoice(models.TextChoices):
        PAY_PER_USE = 'pay_per_use', 'Pay per use'
        ANNUAL = 'annual', 'Annual'

    class Status(models.TextChoices):
        SUBMITTED = 'submitted', 'Submitted'
        CLOSED = 'closed', 'Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='upgrade_intents')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='upgrade_intents',
    )
    plan = models.CharField(max_length=32, choices=PlanChoice.choices)
    note = models.TextField(blank=True)
    contact = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['organization', '-created_at'])]
