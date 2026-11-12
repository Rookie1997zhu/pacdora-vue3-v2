from __future__ import annotations

import uuid

from django.db import models

from apps.assets.models import Asset
from apps.organizations.models import Organization


class DielineFamily(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='dieline_families')
    name_zh = models.CharField(max_length=200)
    name_ko = models.CharField(max_length=200, blank=True)
    category = models.CharField(max_length=80, default='general')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['organization', 'category'])]

    def __str__(self):
        return self.name_zh


class SourceProvider(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='dieline_source_providers')
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=200, blank=True)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['organization', 'code'], name='uniq_dieline_provider_org_code'),
        ]

    def __str__(self):
        return self.code


class SourceTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.ForeignKey(SourceProvider, on_delete=models.CASCADE, related_name='templates')
    external_id = models.CharField(max_length=200)
    version = models.CharField(max_length=64, default='1')
    title = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'external_id', 'version'],
                name='uniq_dieline_source_template',
            ),
        ]

    def __str__(self):
        return f'{self.external_id}@{self.version}'


class AssetVariant(models.Model):
    class DimensionBasis(models.TextChoices):
        INNER = 'inner', 'Inner'
        OUTER = 'outer', 'Outer'
        UNKNOWN = 'unknown', 'Unknown'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='dieline_variants')
    family = models.ForeignKey(DielineFamily, on_delete=models.PROTECT, related_name='variants')
    source_template = models.ForeignKey(
        SourceTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='variants',
    )
    title_zh = models.CharField(max_length=200, blank=True)
    title_ko = models.CharField(max_length=200, blank=True)
    length_mm = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    width_mm = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    height_mm = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    dimension_basis = models.CharField(
        max_length=16,
        choices=DimensionBasis.choices,
        default=DimensionBasis.UNKNOWN,
    )
    material_name = models.CharField(max_length=120, blank=True)
    thickness_mm = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    is_example = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'is_example']),
            models.Index(fields=['family']),
        ]

    def __str__(self):
        return self.title_zh or str(self.id)


class ImmutableRevision(models.Model):
    class AcquisitionStatus(models.TextChoices):
        UNPROCESSED = 'unprocessed', 'Unprocessed'
        OK = 'ok', 'Ok'
        NEEDS_REVIEW = 'needs_review', 'Needs review'
        FAILED = 'failed', 'Failed'

    class RightsStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        GRANTED = 'granted', 'Granted'
        DENIED = 'denied', 'Denied'
        EXPIRED = 'expired', 'Expired'

    class ManufacturingStatus(models.TextChoices):
        REFERENCE_ONLY = 'reference_only', 'Reference only'
        UNVERIFIED = 'unverified', 'Unverified'
        SAMPLE_OK = 'sample_ok', 'Sample ok'
        PRODUCTION_OK = 'production_ok', 'Production ok'

    class PublicationStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        REVIEW = 'review', 'Review'
        PUBLISHED = 'published', 'Published'
        REVOKED = 'revoked', 'Revoked'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(AssetVariant, on_delete=models.CASCADE, related_name='revisions')
    revision_no = models.PositiveIntegerField(default=1)
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name='dieline_revisions')
    sha256 = models.CharField(max_length=64)
    format = models.CharField(max_length=32)
    original_filename = models.CharField(max_length=255, blank=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    acquisition_status = models.CharField(
        max_length=32,
        choices=AcquisitionStatus.choices,
        default=AcquisitionStatus.UNPROCESSED,
    )
    rights_status = models.CharField(
        max_length=32,
        choices=RightsStatus.choices,
        default=RightsStatus.PENDING,
    )
    manufacturing_status = models.CharField(
        max_length=32,
        choices=ManufacturingStatus.choices,
        default=ManufacturingStatus.REFERENCE_ONLY,
    )
    publication_status = models.CharField(
        max_length=32,
        choices=PublicationStatus.choices,
        default=PublicationStatus.DRAFT,
    )
    preview_asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dieline_preview_for',
    )
    idempotency_key = models.CharField(max_length=255, unique=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['variant', 'revision_no'], name='uniq_dieline_variant_revision'),
        ]
        indexes = [
            models.Index(fields=['publication_status', 'rights_status']),
            models.Index(fields=['sha256']),
        ]

    def __str__(self):
        return f'{self.variant_id}#r{self.revision_no}'


class UsageGrant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    revision = models.OneToOneField(ImmutableRevision, on_delete=models.CASCADE, related_name='usage_grant')
    can_store = models.BooleanField(default=False)
    can_transform = models.BooleanField(default=False)
    can_use_internally = models.BooleanField(default=False)
    can_use_commercially = models.BooleanField(default=False)
    can_show_public_preview = models.BooleanField(default=False)
    can_redistribute_files = models.BooleanField(default=False)
    valid_until = models.DateTimeField(null=True, blank=True)
    attribution = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'grant:{self.revision_id}'


class AcquisitionPlan(models.Model):
    class AdapterType(models.TextChoices):
        LOCAL_MANIFEST = 'local_manifest', 'Local manifest'
        SUPPLIER_PACKAGE = 'supplier_package', 'Supplier package'
        AUTHORIZED_BROWSER = 'authorized_browser', 'Authorized browser'
        AUTHORIZED_API = 'authorized_api', 'Authorized API'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        READY = 'ready', 'Ready'
        ARCHIVED = 'archived', 'Archived'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='dieline_acquisition_plans')
    source_provider = models.ForeignKey(
        SourceProvider,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acquisition_plans',
    )
    adapter_type = models.CharField(max_length=32, choices=AdapterType.choices)
    title = models.CharField(max_length=200, blank=True)
    enabled = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    policy_json = models.JSONField(default=dict, blank=True)
    spec_plan_json = models.JSONField(default=list, blank=True)
    budget_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'adapter_type']),
            models.Index(fields=['organization', 'enabled']),
        ]

    def __str__(self):
        return self.title or f'{self.adapter_type}:{self.id}'


class AcquisitionJob(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        PAUSED = 'paused', 'Paused'
        SUCCEEDED = 'succeeded', 'Succeeded'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(AcquisitionPlan, on_delete=models.CASCADE, related_name='jobs')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='dieline_acquisition_jobs')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    dry_run = models.BooleanField(default=True)
    cursor_json = models.JSONField(default=dict, blank=True)
    stats_json = models.JSONField(default=dict, blank=True)
    last_error = models.TextField(blank=True)
    last_error_code = models.CharField(max_length=64, blank=True)
    idempotency_key = models.CharField(max_length=255, unique=True)
    created_by_id = models.UUIDField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['plan', 'status']),
        ]

    def __str__(self):
        return f'job:{self.id}:{self.status}'


class AcquisitionItem(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        SUCCEEDED = 'succeeded', 'Succeeded'
        SKIPPED = 'skipped', 'Skipped'
        FAILED = 'failed', 'Failed'
        BLOCKED = 'blocked', 'Blocked'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(AcquisitionJob, on_delete=models.CASCADE, related_name='items')
    external_key = models.CharField(max_length=255)
    spec_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    failure_reason = models.TextField(blank=True)
    failure_code = models.CharField(max_length=64, blank=True)
    attempt_count = models.PositiveIntegerField(default=0)
    revision = models.ForeignKey(
        ImmutableRevision,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acquisition_items',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['job', 'external_key'], name='uniq_dieline_acq_item_job_key'),
        ]
        indexes = [
            models.Index(fields=['job', 'status']),
        ]

    def __str__(self):
        return f'{self.external_key}:{self.status}'
