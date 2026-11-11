from django.contrib import admin

from apps.orders.models import Cart, CartItem, Order, OrderItem


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    readonly_fields = ('id', 'design', 'design_revision', 'quote', 'quantity', 'created_at')


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'status', 'updated_at')
    list_filter = ('status',)
    inlines = [CartItemInline]


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = (
        'id',
        'design',
        'design_revision',
        'quote',
        'quantity',
        'unit_amount',
        'line_amount',
        'line_status',
    )


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'order_no',
        'status',
        'currency',
        'total_amount',
        'payment_mode',
        'organization',
        'created_at',
    )
    list_filter = ('status', 'payment_mode')
    search_fields = ('order_no', 'idempotency_key', 'id')
    inlines = [OrderItemInline]
    readonly_fields = (
        'id',
        'organization',
        'created_by',
        'order_no',
        'status',
        'currency',
        'total_amount',
        'payment_mode',
        'items_snapshot_json',
        'idempotency_key',
        'row_version',
        'created_at',
        'updated_at',
    )
