from django.contrib import admin

from apps.assets.models import Asset, AssetDerivative, AssetReference


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'owner', 'mime', 'byte_size', 'status', 'created_at')
    list_filter = ('status', 'mime')
    search_fields = ('id', 'original_filename', 'sha256')
    readonly_fields = ('storage_key', 'sha256', 'byte_size', 'created_at', 'updated_at')


@admin.register(AssetDerivative)
class AssetDerivativeAdmin(admin.ModelAdmin):
    list_display = ('id', 'asset', 'kind', 'created_at')


@admin.register(AssetReference)
class AssetReferenceAdmin(admin.ModelAdmin):
    list_display = ('id', 'asset', 'ref_type', 'ref_id', 'created_at')
