from django.contrib import admin

from apps.billing.models import ExportGrant, OrganizationEntitlement, UpgradeIntent


@admin.register(OrganizationEntitlement)
class OrganizationEntitlementAdmin(admin.ModelAdmin):
    list_display = ('organization', 'plan', 'exports_used', 'free_export_limit', 'annual_expires_at', 'updated_at')
    list_filter = ('plan',)
    search_fields = ('organization__name', 'organization__slug')


@admin.register(ExportGrant)
class ExportGrantAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'reason', 'format', 'consumed_quota', 'created_at')
    list_filter = ('reason', 'consumed_quota')


@admin.register(UpgradeIntent)
class UpgradeIntentAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'user', 'plan', 'status', 'created_at')
    list_filter = ('plan', 'status')
