from django.contrib import admin

from apps.quotes.models import PricingRuleVersion, Quote


@admin.register(PricingRuleVersion)
class PricingRuleVersionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'version',
        'organization',
        'currency',
        'is_official',
        'is_active',
        'created_at',
    )
    list_filter = ('is_official', 'is_active', 'currency')
    search_fields = ('version', 'id')


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'status',
        'quantity',
        'currency',
        'total_amount',
        'organization',
        'design',
        'created_at',
    )
    list_filter = ('status', 'currency')
    search_fields = ('id', 'input_hash')
    readonly_fields = (
        'id',
        'organization',
        'created_by',
        'design',
        'design_revision',
        'product',
        'quantity',
        'status',
        'rule_version',
        'currency',
        'total_amount',
        'breakdown_json',
        'input_snapshot',
        'input_hash',
        'valid_until',
        'created_at',
    )
