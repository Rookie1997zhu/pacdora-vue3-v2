from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.assets.models import Asset
from apps.designs.models import Design, DesignRevision
from apps.organizations.models import Organization


class AiJob(models.Model):
    class Operation(models.TextChoices):
        IMAGE_GENERATE = 'image_generate', 'Image generate'
        MAIN_AREA_GENERATE = 'main_area_generate', 'Main area generate'
        IMAGE_EDIT = 'image_edit', 'Image edit'
        REMOVE_BACKGROUND = 'remove_background', 'Remove background'
        VECTORIZE = 'vectorize', 'Vectorize'

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        RUNNING = 'running', 'Running'
        SUCCEEDED = 'succeeded', 'Succeeded'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='ai_jobs')
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name='ai_jobs')
    input_revision = models.ForeignKey(
        DesignRevision,
        on_delete=models.PROTECT,
        related_name='ai_jobs',
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='ai_jobs')
    operation = models.CharField(max_length=40, choices=Operation.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    prompt = models.TextField(blank=True)
    idempotency_key = models.CharField(max_length=128)
    provider = models.CharField(max_length=40, blank=True)
    provider_request_id = models.CharField(max_length=128, blank=True)
    result_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_job_results',
    )
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    meta = models.JSONField(default=dict, blank=True)
    lease_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['organization', 'idempotency_key'], name='uniq_ai_job_org_idem'),
        ]
        indexes = [
            models.Index(fields=['organization', 'status', '-created_at']),
            models.Index(fields=['design', '-created_at']),
        ]

    def __str__(self):
        return f'{self.operation}:{self.status}:{self.id}'


class UsageReservation(models.Model):
    class Status(models.TextChoices):
        HELD = 'held', 'Held'
        SETTLED = 'settled', 'Settled'
        RELEASED = 'released', 'Released'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='usage_reservations')
    job = models.OneToOneField(AiJob, on_delete=models.CASCADE, related_name='reservation')
    units = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.HELD)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class UsageLedger(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='usage_ledger')
    job = models.ForeignKey(AiJob, on_delete=models.SET_NULL, null=True, blank=True, related_name='ledger_entries')
    delta = models.IntegerField()
    reason = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['organization', '-created_at'])]
