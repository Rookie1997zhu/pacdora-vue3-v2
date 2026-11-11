from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.organizations.models import Organization


class Asset(models.Model):
    class Status(models.TextChoices):
        UPLOADING = 'uploading', 'Uploading'
        READY = 'ready', 'Ready'
        REJECTED = 'rejected', 'Rejected'
        DELETED = 'deleted', 'Deleted'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='assets')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='owned_assets')
    storage_key = models.CharField(max_length=512)
    original_filename = models.CharField(max_length=255, blank=True)
    mime = models.CharField(max_length=128)
    byte_size = models.PositiveBigIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True)
    width_px = models.PositiveIntegerField(null=True, blank=True)
    height_px = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADING)
    source = models.CharField(max_length=40, default='upload')
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['sha256']),
        ]

    def __str__(self):
        return f'{self.id}:{self.status}'


class AssetDerivative(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='derivatives')
    kind = models.CharField(max_length=64)
    storage_key = models.CharField(max_length=512)
    mime = models.CharField(max_length=128, blank=True)
    params = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class AssetReference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name='references')
    ref_type = models.CharField(max_length=64)
    ref_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['ref_type', 'ref_id'])]
