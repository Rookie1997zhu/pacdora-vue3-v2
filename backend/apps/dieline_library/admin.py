from django.contrib import admin

from apps.dieline_library import models as m


@admin.register(m.DielineFamily)
class DielineFamilyAdmin(admin.ModelAdmin):
    list_display = ('name_zh', 'category', 'organization', 'created_at')


@admin.register(m.SourceProvider)
class SourceProviderAdmin(admin.ModelAdmin):
    list_display = ('code', 'enabled', 'organization')


@admin.register(m.SourceTemplate)
class SourceTemplateAdmin(admin.ModelAdmin):
    list_display = ('external_id', 'version', 'provider')


@admin.register(m.AssetVariant)
class AssetVariantAdmin(admin.ModelAdmin):
    list_display = ('title_zh', 'length_mm', 'width_mm', 'height_mm', 'is_example', 'organization')


@admin.register(m.ImmutableRevision)
class ImmutableRevisionAdmin(admin.ModelAdmin):
    list_display = (
        'variant',
        'revision_no',
        'format',
        'publication_status',
        'acquisition_status',
        'rights_status',
        'sha256',
    )


@admin.register(m.UsageGrant)
class UsageGrantAdmin(admin.ModelAdmin):
    list_display = ('revision', 'can_use_internally', 'can_redistribute_files', 'valid_until')


@admin.register(m.AcquisitionPlan)
class AcquisitionPlanAdmin(admin.ModelAdmin):
    list_display = ('title', 'adapter_type', 'enabled', 'status', 'organization', 'created_at')


@admin.register(m.AcquisitionJob)
class AcquisitionJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'plan', 'status', 'dry_run', 'last_error_code', 'created_at')


@admin.register(m.AcquisitionItem)
class AcquisitionItemAdmin(admin.ModelAdmin):
    list_display = ('external_key', 'job', 'status', 'failure_code', 'attempt_count')
