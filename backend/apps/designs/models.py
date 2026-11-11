from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.catalog.models import Product
from apps.organizations.models import Organization


class Design(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        ARCHIVED = 'archived', 'Archived'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='designs')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='owned_designs')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='designs')
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    row_version = models.PositiveIntegerField(default=1)
    current_revision = models.ForeignKey(
        'DesignRevision',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'status', '-updated_at']),
            models.Index(fields=['owner', 'status']),
        ]

    def __str__(self):
        return f'{self.name} ({self.id})'


class DesignRevision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name='revisions')
    revision_no = models.PositiveIntegerField()
    schema_version = models.CharField(max_length=40, default='boxcraft.design.v1')
    content_json = models.JSONField()
    content_hash = models.CharField(max_length=64)
    geometry_hash = models.CharField(max_length=256)
    template_version = models.CharField(max_length=64)
    engine_version = models.CharField(max_length=64)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_revisions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['design', 'revision_no'], name='uniq_design_revision_no'),
        ]
        indexes = [models.Index(fields=['design', '-revision_no'])]

    def __str__(self):
        return f'{self.design_id}#r{self.revision_no}'


class DesignViewPreference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='design_view_prefs')
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name='view_prefs')
    camera = models.JSONField(default=dict, blank=True)
    zoom = models.FloatField(default=1.0)
    fold_progress = models.FloatField(default=0.0)
    tool = models.CharField(max_length=64, blank=True)
    selected_layer_ids = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'design'], name='uniq_user_design_view_pref'),
        ]


class IdempotencyRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='idempotency_records')
    key = models.CharField(max_length=128)
    request_hash = models.CharField(max_length=64)
    response_json = models.JSONField()
    http_status = models.PositiveIntegerField(default=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['organization', 'key'], name='uniq_org_idempotency_key'),
        ]


class OutboxEvent(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=80)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveIntegerField(default=0)
    available_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['status', 'available_at'])]
