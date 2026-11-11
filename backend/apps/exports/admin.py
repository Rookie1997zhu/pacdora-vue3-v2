from django.contrib import admin

from apps.exports.models import ExportJob


@admin.register(ExportJob)
class ExportJobAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'design',
        'format',
        'quality_tier',
        'status',
        'created_at',
        'finished_at',
    )
    list_filter = ('status', 'format', 'quality_tier')
    search_fields = ('id', 'idempotency_key', 'design__name')
    readonly_fields = (
        'id',
        'content_hash',
        'geometry_hash',
        'engine_version',
        'exporter_version',
        'checksum',
        'preflight',
        'created_at',
        'updated_at',
        'finished_at',
    )
