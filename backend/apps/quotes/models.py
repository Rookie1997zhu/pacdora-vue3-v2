from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.catalog.models import Product
from apps.designs.models import Design, DesignRevision
from apps.organizations.models import Organization


class PricingRuleVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='pricing_rule_versions',
    )
    version = models.CharField(max_length=64)
    currency = models.CharField(max_length=8, default='KRW')
    rules_json = models.JSONField(default=dict, blank=True)
    is_official = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['is_official', 'is_active', '-created_at']),
            models.Index(fields=['organization', 'is_official', 'is_active']),
        ]

    def __str__(self):
        scope = self.organization_id or 'global'
        return f'pricing@{scope}:{self.version}:official={self.is_official}'


class Quote(models.Model):
    class Status(models.TextChoices):
        PENDING_MANUAL = 'pending_manual', 'Pending manual'
        VALID = 'valid', 'Valid'
        EXPIRED = 'expired', 'Expired'
        SUPERSEDED = 'superseded', 'Superseded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='quotes')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_quotes',
    )
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name='quotes')
    design_revision = models.ForeignKey(
        DesignRevision,
        on_delete=models.PROTECT,
        related_name='quotes',
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes',
    )
    quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING_MANUAL)
    rule_version = models.ForeignKey(
        PricingRuleVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes',
    )
    currency = models.CharField(max_length=8, default='KRW')
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    breakdown_json = models.JSONField(default=dict, blank=True)
    input_snapshot = models.JSONField(default=dict, blank=True)
    input_hash = models.CharField(max_length=64)
    valid_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', '-created_at']),
            models.Index(fields=['design', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f'quote:{self.status}:{self.id}'
