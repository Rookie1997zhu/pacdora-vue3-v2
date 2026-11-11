from __future__ import annotations

import uuid

from django.db import models


class TemplateDefinition(models.Model):
    class GeometryMode(models.TextChoices):
        PARAMETRIC = 'parametric', 'Parametric'
        FIXED_SNAPSHOT = 'fixed_snapshot', 'Fixed snapshot'
        MODEL_ONLY = 'model_only', 'Model only'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_key = models.CharField(max_length=120, unique=True)
    title = models.CharField(max_length=200)
    geometry_mode = models.CharField(max_length=32, choices=GeometryMode.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.template_key


class TemplateVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(TemplateDefinition, on_delete=models.CASCADE, related_name='versions')
    version = models.CharField(max_length=64)
    engine_version = models.CharField(max_length=64, default='boxcraft.knife.v3')
    param_schema = models.JSONField(default=dict, blank=True)
    limits = models.JSONField(default=dict, blank=True)
    capabilities = models.JSONField(default=dict, blank=True)
    is_current = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['template', 'version'], name='uniq_template_version'),
        ]
        indexes = [models.Index(fields=['template', 'is_current'])]

    def __str__(self):
        return f'{self.template.template_key}@{self.version}'


class TemplateApproval(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_version = models.ForeignKey(TemplateVersion, on_delete=models.CASCADE, related_name='approvals')
    material_ids = models.JSONField(default=list, blank=True)
    thickness_min_mm = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    thickness_max_mm = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    notes = models.TextField(blank=True)
    approved = models.BooleanField(default=False)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'approval:{self.template_version_id}:{self.approved}'


class Product(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=160, unique=True)
    name = models.CharField(max_length=200)
    name_ko = models.CharField(max_length=200, blank=True)
    category = models.CharField(max_length=80, default='general')
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    default_template = models.ForeignKey(
        TemplateDefinition,
        on_delete=models.PROTECT,
        related_name='products',
    )
    default_template_version = models.ForeignKey(
        TemplateVersion,
        on_delete=models.PROTECT,
        related_name='products',
        null=True,
        blank=True,
    )
    capabilities = models.JSONField(default=dict, blank=True)
    cover_rel = models.CharField(max_length=255, blank=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'sort_order']),
            models.Index(fields=['category', 'status']),
        ]

    def __str__(self):
        return self.slug


class ProductVariant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    code = models.CharField(max_length=64)
    material_id = models.CharField(max_length=64, default='kraft')
    coating = models.CharField(max_length=64, blank=True)
    min_quantity = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['product', 'code'], name='uniq_product_variant_code'),
        ]
