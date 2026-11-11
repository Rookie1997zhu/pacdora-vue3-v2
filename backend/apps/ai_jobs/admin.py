from django.contrib import admin

from apps.ai_jobs.models import AiJob, UsageLedger, UsageReservation


@admin.register(AiJob)
class AiJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'operation', 'status', 'organization', 'design', 'provider', 'created_at')
    list_filter = ('operation', 'status', 'provider')
    search_fields = ('id', 'prompt', 'idempotency_key', 'error_code')
    readonly_fields = (
        'id',
        'organization',
        'design',
        'input_revision',
        'owner',
        'operation',
        'prompt',
        'idempotency_key',
        'provider',
        'provider_request_id',
        'result_asset',
        'error_code',
        'error_message',
        'meta',
        'lease_until',
        'created_at',
        'updated_at',
        'finished_at',
    )


@admin.register(UsageReservation)
class UsageReservationAdmin(admin.ModelAdmin):
    list_display = ('id', 'job', 'organization', 'units', 'status', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('id', 'organization', 'job', 'units', 'status', 'created_at', 'updated_at')


@admin.register(UsageLedger)
class UsageLedgerAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'job', 'delta', 'reason', 'created_at')
    readonly_fields = ('id', 'organization', 'job', 'delta', 'reason', 'created_at')
