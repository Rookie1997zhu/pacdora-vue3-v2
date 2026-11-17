from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.assets.models import Asset
from apps.organizations.models import Organization


class RenderScene(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='render_scenes',
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='owned_render_scenes',
    )
    name = models.CharField(max_length=200)
    content_json = models.JSONField(default=dict)
    schema_version = models.CharField(max_length=40, default='boxcraft.render_scene.v2')
    row_version = models.PositiveIntegerField(default=1)
    cover_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='render_scene_covers',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', '-updated_at']),
            models.Index(fields=['owner', '-updated_at']),
        ]

    def __str__(self):
        return f'{self.name} ({self.id})'


class RenderJob(models.Model):
    class Format(models.TextChoices):
        PNG = 'png', 'PNG'
        JPG = 'jpg', 'JPG'

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        RUNNING = 'running', 'Running'
        SUCCEEDED = 'succeeded', 'Succeeded'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='render_jobs',
    )
    scene = models.ForeignKey(
        RenderScene,
        on_delete=models.CASCADE,
        related_name='jobs',
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='render_jobs',
    )
    batch = models.ForeignKey(
        'RenderBatch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='jobs',
    )
    view_id = models.CharField(max_length=64, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    format = models.CharField(max_length=8, choices=Format.choices, default=Format.PNG)
    scene_snapshot = models.JSONField(default=dict, blank=True)
    input_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='render_job_inputs',
    )
    result_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='render_job_results',
    )
    idempotency_key = models.CharField(max_length=128)
    export_grant_id = models.UUIDField(null=True, blank=True)
    checksum = models.CharField(max_length=64, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    samples = models.PositiveIntegerField(default=64)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'idempotency_key'],
                name='uniq_render_job_org_idem',
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'status', '-created_at']),
            models.Index(fields=['scene', '-created_at']),
            models.Index(fields=['batch', 'status']),
        ]

    def __str__(self):
        return f'{self.width}x{self.height}:{self.status}:{self.id}'


class RenderBatch(models.Model):
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        RUNNING = 'running', 'Running'
        SUCCEEDED = 'succeeded', 'Succeeded'
        FAILED = 'failed', 'Failed'
        PARTIAL = 'partial', 'Partial'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='render_batches',
    )
    scene = models.ForeignKey(
        RenderScene,
        on_delete=models.CASCADE,
        related_name='batches',
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='render_batches',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    format = models.CharField(max_length=8, choices=RenderJob.Format.choices, default=RenderJob.Format.PNG)
    view_ids = models.JSONField(default=list, blank=True)
    shared_input_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='render_batch_inputs',
    )
    job_count = models.PositiveIntegerField(default=0)
    succeeded_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    idempotency_key = models.CharField(max_length=128)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'idempotency_key'],
                name='uniq_render_batch_org_idem',
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'status', '-created_at']),
            models.Index(fields=['scene', '-created_at']),
        ]

    def __str__(self):
        return f'batch:{self.status}:{self.id}'


class RenderProp(models.Model):
    class Source(models.TextChoices):
        OFFICIAL = 'official', 'Official'
        UPLOAD = 'upload', 'Upload'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='render_props',
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='owned_render_props',
    )
    name = models.CharField(max_length=200)
    slug = models.CharField(max_length=64, blank=True, default='')
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.UPLOAD)
    is_official = models.BooleanField(default=False)
    asset = models.ForeignKey(
        Asset,
        on_delete=models.PROTECT,
        related_name='render_props',
    )
    preview_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='render_prop_previews',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['is_official', 'name']),
            models.Index(fields=['organization', '-updated_at']),
            models.Index(fields=['slug']),
        ]

    def __str__(self):
        return f'{self.name} ({self.id})'


class RenderEnvironment(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    name = models.CharField(max_length=200)
    asset = models.ForeignKey(
        Asset,
        on_delete=models.PROTECT,
        related_name='render_environments',
    )
    preview_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='render_environment_previews',
    )
    default_intensity = models.FloatField(default=1.0)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.name


class RenderSceneTemplate(models.Model):
    class Tier(models.TextChoices):
        BASIC = 'basic', 'Basic'
        ADVANCED = 'advanced', 'Advanced'

    id = models.CharField(primary_key=True, max_length=64)
    name = models.CharField(max_length=200)
    tier = models.CharField(max_length=16, choices=Tier.choices, default=Tier.BASIC)
    cover_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='render_template_covers',
    )
    content_json = models.JSONField(default=dict)
    slot_ids = models.JSONField(default=list, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.name
