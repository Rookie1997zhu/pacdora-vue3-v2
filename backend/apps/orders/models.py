from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.designs.models import Design, DesignRevision
from apps.organizations.models import Organization
from apps.quotes.models import Quote


class Cart(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        CHECKED_OUT = 'checked_out', 'Checked out'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='carts')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'status', '-updated_at']),
        ]

    def __str__(self):
        return f'cart:{self.status}:{self.id}'


class CartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name='cart_items')
    design_revision = models.ForeignKey(
        DesignRevision,
        on_delete=models.PROTECT,
        related_name='cart_items',
    )
    quote = models.ForeignKey(
        Quote,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cart_items',
    )
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['cart', 'design_revision'], name='uniq_cart_design_revision'),
        ]
        indexes = [
            models.Index(fields=['cart', '-created_at']),
        ]

    def __str__(self):
        return f'cart_item:{self.cart_id}:{self.design_revision_id}'


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_MANUAL = 'pending_manual', 'Pending manual'
        QUOTED = 'quoted', 'Quoted'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='orders')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_orders',
    )
    order_no = models.CharField(max_length=40)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING_MANUAL)
    currency = models.CharField(max_length=8, default='KRW')
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    payment_mode = models.CharField(max_length=32, default='manual_quote')
    items_snapshot_json = models.JSONField(default=list, blank=True)
    idempotency_key = models.CharField(max_length=128)
    row_version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'idempotency_key'],
                name='uniq_order_org_idempotency',
            ),
            models.UniqueConstraint(fields=['organization', 'order_no'], name='uniq_order_org_order_no'),
        ]
        indexes = [
            models.Index(fields=['organization', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f'order:{self.order_no}:{self.status}'


class OrderItem(models.Model):
    class LineStatus(models.TextChoices):
        PRICED = 'priced', 'Priced'
        PENDING_MANUAL = 'pending_manual', 'Pending manual'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    design = models.ForeignKey(Design, on_delete=models.PROTECT, related_name='order_items')
    design_revision = models.ForeignKey(
        DesignRevision,
        on_delete=models.PROTECT,
        related_name='order_items',
    )
    quote = models.ForeignKey(
        Quote,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='order_items',
    )
    quantity = models.PositiveIntegerField()
    unit_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    line_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    line_status = models.CharField(
        max_length=32,
        choices=LineStatus.choices,
        default=LineStatus.PENDING_MANUAL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['order', 'line_status']),
        ]

    def __str__(self):
        return f'order_item:{self.order_id}:{self.design_revision_id}'
