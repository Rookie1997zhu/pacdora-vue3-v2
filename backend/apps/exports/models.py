from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.assets.models import Asset
from apps.designs.models import Design, DesignRevision
from apps.organizations.models import Organization


class ExportJob(models.Model):
    class Format(models.TextChoices):
        SVG = 'svg', 'SVG'
        DXF = 'dxf', 'DXF'
        PDF = 'pdf', 'PDF'

    class QualityTier(models.TextChoices):
        PREVIEW = 'preview', 'Preview'
        VECTOR_PROOF = 'vector_proof', 'Vector proof'
        MANUFACTURING = 'manufacturing', 'Manufacturing'

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        RUNNING = 'running', 'Running'
        SUCCEEDED = 'succeeded', 'Succeeded'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='export_jobs')
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name='export_jobs')
    input_revision = models.ForeignKey(
        DesignRevision,
        on_delete=models.PROTECT,
        related_name='export_jobs',
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='export_jobs')
    format = models.CharField(max_length=16, choices=Format.choices)
    quality_tier = models.CharField(max_length=32, choices=QualityTier.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    idempotency_key = models.CharField(max_length=128)
    content_hash = models.CharField(max_length=64, blank=True)
    geometry_hash = models.CharField(max_length=256, blank=True)
    engine_version = models.CharField(max_length=64, blank=True)
    exporter_version = models.CharField(max_length=64, blank=True)
    options = models.JSONField(default=dict, blank=True)
    preflight = models.JSONField(default=dict, blank=True)
    result_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='export_job_results',
    )
    checksum = models.CharField(max_length=64, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['organization', 'idempotency_key'], name='uniq_export_job_org_idem'),
        ]
        indexes = [
            models.Index(fields=['organization', 'status', '-created_at']),
            models.Index(fields=['design', '-created_at']),
        ]

    def __str__(self):
        return f'{self.format}:{self.quality_tier}:{self.status}:{self.id}'
