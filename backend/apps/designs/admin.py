from django.contrib import admin

from apps.designs.models import (
    Design,
    DesignRevision,
    DesignViewPreference,
    IdempotencyRecord,
    OutboxEvent,
)


class DesignRevisionInline(admin.TabularInline):
    model = DesignRevision
    extra = 0
    readonly_fields = (
        'revision_no',
        'schema_version',
        'content_hash',
        'geometry_hash',
        'template_version',
        'engine_version',
        'created_at',
    )
    can_delete = False
    show_change_link = True


@admin.register(Design)
class DesignAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'owner', 'status', 'row_version', 'updated_at')
    list_filter = ('status',)
    search_fields = ('name', 'id')
    inlines = [DesignRevisionInline]


@admin.register(DesignRevision)
class DesignRevisionAdmin(admin.ModelAdmin):
    list_display = ('design', 'revision_no', 'geometry_hash', 'created_at')
    search_fields = ('design__name', 'id')
    readonly_fields = (
        'design',
        'revision_no',
        'schema_version',
        'content_json',
        'content_hash',
        'geometry_hash',
        'template_version',
        'engine_version',
        'creator',
        'created_at',
    )


@admin.register(DesignViewPreference)
class DesignViewPreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'design', 'zoom', 'fold_progress', 'updated_at')


@admin.register(IdempotencyRecord)
class IdempotencyRecordAdmin(admin.ModelAdmin):
    list_display = ('organization', 'key', 'http_status', 'created_at')
    search_fields = ('key',)


@admin.register(OutboxEvent)
class OutboxEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'status', 'attempts', 'created_at')
    list_filter = ('status', 'event_type')
