from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.assets.models import Asset
from apps.catalog.models import TemplateVersion
from apps.designs.models import DesignRevision
from apps.organizations.models import Organization


class SampleTestRecord(models.Model):
    class Verdict(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PASS = 'pass', 'Pass'
        FAIL = 'fail', 'Fail'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='sample_tests',
    )
    template_key = models.CharField(max_length=160, db_index=True)
    template_version = models.ForeignKey(
        TemplateVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sample_tests',
    )
    design_revision = models.ForeignKey(
        DesignRevision,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sample_tests',
    )
    geometry_hash = models.CharField(max_length=256)

    length_mm = models.DecimalField(max_digits=10, decimal_places=3)
    width_mm = models.DecimalField(max_digits=10, decimal_places=3)
    height_mm = models.DecimalField(max_digits=10, decimal_places=3)
    thickness_mm = models.DecimalField(max_digits=8, decimal_places=3)
    material_id = models.CharField(max_length=64, default='kraft')
    flute_direction = models.CharField(max_length=8, default='L')
    size_mode = models.CharField(max_length=16, default='inner')

    # Narrow qualified domain (defaults to exact tested size on pass).
    length_min_mm = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    length_max_mm = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    width_min_mm = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    width_max_mm = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    height_min_mm = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    height_max_mm = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    thickness_min_mm = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    thickness_max_mm = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)

    process_profile = models.CharField(max_length=160, blank=True)
    equipment = models.CharField(max_length=160, blank=True)
    notes = models.TextField(blank=True)
    measurements = models.JSONField(default=dict, blank=True)

    verdict = models.CharField(
        max_length=16,
        choices=Verdict.choices,
        default=Verdict.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_sample_tests',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_sample_tests',
    )
    evidence_assets = models.ManyToManyField(Asset, blank=True, related_name='sample_tests')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'template_key', 'verdict']),
            models.Index(fields=['template_key', 'verdict', 'material_id']),
        ]

    def __str__(self):
        return f'sample:{self.template_key}:{self.verdict}:{self.id}'
