from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.designs.models import DesignRevision
from apps.orders.models import Cart, CartItem, Order, OrderItem
from apps.quotes.models import Quote
from apps.quotes.services import QuoteServiceError, create_quote, serialize_quote


class OrderServiceError(Exception):
    def __init__(self, message, *, code='ORDER_ERROR', status=400, errors=None, data=None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.errors = errors or {}
        self.data = data


def get_or_create_active_cart(organization) -> Cart:
    cart = (
        Cart.objects.filter(organization=organization, status=Cart.Status.ACTIVE)
        .order_by('-updated_at')
        .first()
    )
    if cart:
        return cart
    return Cart.objects.create(organization=organization, status=Cart.Status.ACTIVE)


def serialize_cart_item(item: CartItem) -> dict:
    from apps.assets.preview import preview_fields_for_content

    quote_data = None
    if item.quote_id:
        quote_data = serialize_quote(item.quote)
    content = None
    rev = getattr(item, 'design_revision', None)
    if rev is not None:
        content = rev.content_json
    preview = preview_fields_for_content(content)
    return {
        'id': str(item.id),
        'design_id': str(item.design_id),
        'design_revision_id': str(item.design_revision_id),
        'quote_id': str(item.quote_id) if item.quote_id else None,
        'quote': quote_data,
        'quantity': item.quantity,
        'preview_asset_id': preview['preview_asset_id'],
        'thumbnail_ready': preview['thumbnail_ready'],
        'created_at': item.created_at.isoformat() if item.created_at else None,
        'updated_at': item.updated_at.isoformat() if item.updated_at else None,
    }


def serialize_cart(cart: Cart) -> dict:
    items = (
        CartItem.objects.filter(cart=cart)
        .select_related('quote', 'design', 'design_revision')
        .order_by('created_at')
    )
    return {
        'id': str(cart.id),
        'organization_id': str(cart.organization_id),
        'status': cart.status,
        'items': [serialize_cart_item(i) for i in items],
        'updated_at': cart.updated_at.isoformat() if cart.updated_at else None,
        'created_at': cart.created_at.isoformat() if cart.created_at else None,
        'payment_mode': 'manual_quote',
    }


def serialize_order_item(item: OrderItem) -> dict:
    return {
        'id': str(item.id),
        'design_id': str(item.design_id),
        'design_revision_id': str(item.design_revision_id),
        'quote_id': str(item.quote_id) if item.quote_id else None,
        'quantity': item.quantity,
        'unit_amount': str(item.unit_amount) if item.unit_amount is not None else None,
        'line_amount': str(item.line_amount) if item.line_amount is not None else None,
        'line_status': item.line_status,
    }


def serialize_order(order: Order) -> dict:
    items = OrderItem.objects.filter(order=order).order_by('created_at')
    return {
        'id': str(order.id),
        'organization_id': str(order.organization_id),
        'order_no': order.order_no,
        'status': order.status,
        'currency': order.currency,
        'total_amount': str(order.total_amount) if order.total_amount is not None else None,
        'payment_mode': order.payment_mode,
        'items_snapshot': order.items_snapshot_json or [],
        'items': [serialize_order_item(i) for i in items],
        'row_version': order.row_version,
        'idempotency_key': order.idempotency_key,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'updated_at': order.updated_at.isoformat() if order.updated_at else None,
    }


def add_cart_item(*, organization, user, design_revision_id, quantity, quote_id=None) -> CartItem:
    if quantity is None or int(quantity) < 1:
        raise OrderServiceError(
            'quantity must be >= 1',
            code='VALIDATION_ERROR',
            status=400,
            errors={'quantity': ['min_1']},
        )
    quantity = int(quantity)

    try:
        revision = DesignRevision.objects.select_related('design', 'design__organization').get(
            id=design_revision_id
        )
    except (DesignRevision.DoesNotExist, ValueError, TypeError) as exc:
        raise OrderServiceError(
            'design revision not found',
            code='REVISION_NOT_FOUND',
            status=404,
            errors={'design_revision_id': ['not_found']},
        ) from exc

    design = revision.design
    if design.organization_id != organization.id:
        raise OrderServiceError('无权访问设计', code='FORBIDDEN', status=403)

    quote = None
    if quote_id:
        try:
            quote = Quote.objects.select_related('design_revision').get(id=quote_id)
        except (Quote.DoesNotExist, ValueError, TypeError) as exc:
            raise OrderServiceError(
                'quote not found',
                code='QUOTE_NOT_FOUND',
                status=404,
                errors={'quote_id': ['not_found']},
            ) from exc
        if quote.organization_id != organization.id:
            raise OrderServiceError('无权访问报价', code='FORBIDDEN', status=403)
        if str(quote.design_revision_id) != str(revision.id):
            raise OrderServiceError(
                'quote revision mismatch',
                code='VALIDATION_ERROR',
                status=400,
                errors={'quote_id': ['revision_mismatch']},
            )
    else:
        try:
            quote = create_quote(
                organization=organization,
                user=user,
                design_revision_id=str(revision.id),
                quantity=quantity,
            )
        except QuoteServiceError as exc:
            raise OrderServiceError(
                str(exc),
                code=exc.code,
                status=exc.status,
                errors=exc.errors,
                data=exc.data,
            ) from exc

    cart = get_or_create_active_cart(organization)
    item, created = CartItem.objects.get_or_create(
        cart=cart,
        design_revision=revision,
        defaults={
            'design': design,
            'quote': quote,
            'quantity': quantity,
        },
    )
    if not created:
        item.quantity = quantity
        item.quote = quote
        item.design = design
        item.save(update_fields=['quantity', 'quote', 'design', 'updated_at'])
    cart.save(update_fields=['updated_at'])
    return item


def update_cart_item(*, organization, item_id, quantity) -> CartItem:
    if quantity is None or int(quantity) < 1:
        raise OrderServiceError(
            'quantity must be >= 1',
            code='VALIDATION_ERROR',
            status=400,
            errors={'quantity': ['min_1']},
        )
    quantity = int(quantity)
    item = (
        CartItem.objects.select_related('cart', 'quote')
        .filter(id=item_id, cart__organization=organization, cart__status=Cart.Status.ACTIVE)
        .first()
    )
    if not item:
        raise OrderServiceError('cart item not found', code='NOT_FOUND', status=404)
    item.quantity = quantity
    item.save(update_fields=['quantity', 'updated_at'])
    item.cart.save(update_fields=['updated_at'])
    return item


def remove_cart_item(*, organization, item_id) -> None:
    item = CartItem.objects.filter(
        id=item_id,
        cart__organization=organization,
        cart__status=Cart.Status.ACTIVE,
    ).first()
    if not item:
        raise OrderServiceError('cart item not found', code='NOT_FOUND', status=404)
    cart = item.cart
    item.delete()
    cart.save(update_fields=['updated_at'])


def _next_order_no(organization) -> str:
    stamp = timezone.now().strftime('%Y%m%d%H%M%S')
    count = Order.objects.filter(organization=organization).count() + 1
    return f'BC-{stamp}-{count:04d}'


def checkout_cart(*, organization, user, idempotency_key: str) -> tuple[Order, bool]:
    key = (idempotency_key or '').strip()
    if not key:
        raise OrderServiceError(
            'Idempotency-Key required',
            code='VALIDATION_ERROR',
            status=400,
            errors={'idempotency_key': ['required']},
        )

    existing = Order.objects.filter(organization=organization, idempotency_key=key).first()
    if existing:
        return existing, True

    cart = get_or_create_active_cart(organization)
    items = list(
        CartItem.objects.filter(cart=cart)
        .select_related('quote', 'design', 'design_revision')
        .order_by('created_at')
    )
    if not items:
        raise OrderServiceError('cart is empty', code='CART_EMPTY', status=400)

    snapshot_lines = []
    order_lines = []
    any_pending = False
    total = Decimal('0.00')
    currency = 'KRW'

    for item in items:
        quote = item.quote
        if quote is None or quote.status != Quote.Status.VALID or quote.total_amount is None:
            any_pending = True
            line_status = OrderItem.LineStatus.PENDING_MANUAL
            unit_amount = None
            line_amount = None
        else:
            line_status = OrderItem.LineStatus.PRICED
            unit_amount = None
            line_amount = quote.total_amount
            total += quote.total_amount
            currency = quote.currency or currency
            breakdown = quote.breakdown_json or {}
            if breakdown.get('unit_price') is not None:
                try:
                    unit_amount = Decimal(str(breakdown['unit_price']))
                except Exception:  # noqa: BLE001
                    unit_amount = None

        snap = {
            'cart_item_id': str(item.id),
            'design_id': str(item.design_id),
            'design_revision_id': str(item.design_revision_id),
            'quote_id': str(quote.id) if quote else None,
            'quote_status': quote.status if quote else None,
            'quantity': item.quantity,
            'line_status': line_status,
            'line_amount': str(line_amount) if line_amount is not None else None,
            'input_snapshot': (quote.input_snapshot if quote else {}) or {},
            'breakdown': (quote.breakdown_json if quote else {}) or {},
        }
        snapshot_lines.append(snap)
        order_lines.append(
            {
                'design': item.design,
                'design_revision': item.design_revision,
                'quote': quote,
                'quantity': item.quantity,
                'unit_amount': unit_amount,
                'line_amount': line_amount,
                'line_status': line_status,
            }
        )

    status = Order.Status.PENDING_MANUAL if any_pending else Order.Status.QUOTED
    total_amount = None if any_pending else total.quantize(Decimal('0.01'))

    with transaction.atomic():
        again = Order.objects.filter(organization=organization, idempotency_key=key).first()
        if again:
            return again, True
        order = Order.objects.create(
            organization=organization,
            created_by=user,
            order_no=_next_order_no(organization),
            status=status,
            currency=currency,
            total_amount=total_amount,
            payment_mode='manual_quote',
            items_snapshot_json=snapshot_lines,
            idempotency_key=key,
            row_version=1,
        )
        for line in order_lines:
            OrderItem.objects.create(order=order, **line)
        cart.status = Cart.Status.CHECKED_OUT
        cart.save(update_fields=['status', 'updated_at'])
        # New empty active cart for subsequent shopping
        Cart.objects.create(organization=organization, status=Cart.Status.ACTIVE)

    return order, False


def _get_org_order(*, organization, order_id) -> Order:
    try:
        order = Order.objects.select_related('organization').get(id=order_id)
    except (Order.DoesNotExist, ValueError, TypeError) as exc:
        raise OrderServiceError('order not found', code='NOT_FOUND', status=404) from exc
    if order.organization_id != organization.id:
        raise OrderServiceError('无权访问订单', code='FORBIDDEN', status=403)
    return order


def _assert_row_version(order: Order, expected_row_version) -> None:
    try:
        expected = int(expected_row_version)
    except (TypeError, ValueError) as exc:
        raise OrderServiceError(
            'expected_row_version required',
            code='VALIDATION_ERROR',
            status=400,
            errors={'expected_row_version': ['required']},
        ) from exc
    if order.row_version != expected:
        raise OrderServiceError(
            '订单已在其他窗口更新',
            code='ORDER_VERSION_CONFLICT',
            status=409,
            errors={'expected_row_version': ['stale']},
            data={'row_version': order.row_version},
        )


def _parse_positive_amount(value, *, field: str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except Exception as exc:  # noqa: BLE001
        raise OrderServiceError(
            f'{field} invalid',
            code='VALIDATION_ERROR',
            status=400,
            errors={field: ['invalid']},
        ) from exc
    if amount <= 0:
        raise OrderServiceError(
            f'{field} must be > 0',
            code='VALIDATION_ERROR',
            status=400,
            errors={field: ['min_positive']},
        )
    return amount.quantize(Decimal('0.01'))


def apply_manual_quote(*, organization, user, order_id, expected_row_version, lines) -> Order:
    del user  # reserved for future audit; permission is org membership
    order = _get_org_order(organization=organization, order_id=order_id)
    if order.status != Order.Status.PENDING_MANUAL:
        raise OrderServiceError(
            'only pending_manual orders accept manual quote',
            code='INVALID_STATUS',
            status=400,
            errors={'status': [order.status]},
        )
    _assert_row_version(order, expected_row_version)

    if not isinstance(lines, list) or not lines:
        raise OrderServiceError(
            'lines required',
            code='VALIDATION_ERROR',
            status=400,
            errors={'lines': ['required']},
        )

    pending_items = list(
        OrderItem.objects.filter(order=order, line_status=OrderItem.LineStatus.PENDING_MANUAL)
        .select_related('quote')
        .order_by('created_at')
    )
    if not pending_items:
        raise OrderServiceError(
            'no pending_manual lines',
            code='VALIDATION_ERROR',
            status=400,
            errors={'lines': ['empty']},
        )

    amount_by_id: dict[str, Decimal] = {}
    for raw in lines:
        if not isinstance(raw, dict):
            raise OrderServiceError(
                'line must be object',
                code='VALIDATION_ERROR',
                status=400,
                errors={'lines': ['invalid']},
            )
        line_id = str(raw.get('id') or '')
        if not line_id:
            raise OrderServiceError(
                'line id required',
                code='VALIDATION_ERROR',
                status=400,
                errors={'lines': ['id_required']},
            )
        if line_id in amount_by_id:
            raise OrderServiceError(
                'duplicate line id',
                code='VALIDATION_ERROR',
                status=400,
                errors={'lines': ['duplicate']},
            )
        amount_by_id[line_id] = _parse_positive_amount(raw.get('line_amount'), field='line_amount')

    pending_ids = {str(item.id) for item in pending_items}
    if set(amount_by_id.keys()) != pending_ids:
        raise OrderServiceError(
            'lines must cover all pending_manual items',
            code='VALIDATION_ERROR',
            status=400,
            errors={'lines': ['coverage']},
        )

    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if locked.status != Order.Status.PENDING_MANUAL:
            raise OrderServiceError(
                'only pending_manual orders accept manual quote',
                code='INVALID_STATUS',
                status=400,
                errors={'status': [locked.status]},
            )
        _assert_row_version(locked, expected_row_version)

        total = Decimal('0.00')
        snapshot = list(locked.items_snapshot_json or [])
        for item in pending_items:
            amount = amount_by_id[str(item.id)]
            unit = None
            if item.quantity and item.quantity > 0:
                unit = (amount / Decimal(item.quantity)).quantize(Decimal('0.01'))
            item.line_amount = amount
            item.unit_amount = unit
            item.line_status = OrderItem.LineStatus.PRICED
            item.save(update_fields=['line_amount', 'unit_amount', 'line_status'])
            total += amount

            breakdown = None
            if item.quote_id:
                quote = item.quote
                breakdown = dict(quote.breakdown_json or {})
                breakdown['source'] = 'manual_fill'
                breakdown['line_amount'] = str(amount)
                if unit is not None:
                    breakdown['unit_price'] = str(unit)
                quote.status = Quote.Status.VALID
                quote.total_amount = amount
                quote.currency = locked.currency or quote.currency
                quote.breakdown_json = breakdown
                quote.save(
                    update_fields=['status', 'total_amount', 'currency', 'breakdown_json']
                )

            matched = False
            for snap in snapshot:
                same_quote = item.quote_id and str(snap.get('quote_id')) == str(item.quote_id)
                same_rev_pending = (
                    not matched
                    and str(snap.get('design_revision_id')) == str(item.design_revision_id)
                    and snap.get('line_status') == OrderItem.LineStatus.PENDING_MANUAL
                )
                if not (same_quote or same_rev_pending):
                    continue
                snap['line_status'] = OrderItem.LineStatus.PRICED
                snap['line_amount'] = str(amount)
                if item.quote_id:
                    snap['quote_status'] = Quote.Status.VALID
                if breakdown is not None:
                    snap['breakdown'] = breakdown
                matched = True
                break

        locked.total_amount = total.quantize(Decimal('0.01'))
        locked.status = Order.Status.QUOTED
        locked.items_snapshot_json = snapshot
        locked.row_version = locked.row_version + 1
        locked.save(
            update_fields=[
                'total_amount',
                'status',
                'items_snapshot_json',
                'row_version',
                'updated_at',
            ]
        )
        return locked


def confirm_order(*, organization, order_id, expected_row_version) -> Order:
    order = _get_org_order(organization=organization, order_id=order_id)
    if order.status != Order.Status.QUOTED:
        raise OrderServiceError(
            'only quoted orders can be confirmed',
            code='INVALID_STATUS',
            status=400,
            errors={'status': [order.status]},
        )
    _assert_row_version(order, expected_row_version)

    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if locked.status != Order.Status.QUOTED:
            raise OrderServiceError(
                'only quoted orders can be confirmed',
                code='INVALID_STATUS',
                status=400,
                errors={'status': [locked.status]},
            )
        _assert_row_version(locked, expected_row_version)
        locked.status = Order.Status.CONFIRMED
        locked.row_version = locked.row_version + 1
        locked.save(update_fields=['status', 'row_version', 'updated_at'])
        return locked


def cancel_order(*, organization, order_id, expected_row_version) -> Order:
    order = _get_org_order(organization=organization, order_id=order_id)
    if order.status not in (Order.Status.PENDING_MANUAL, Order.Status.QUOTED):
        raise OrderServiceError(
            'only pending_manual or quoted orders can be cancelled',
            code='INVALID_STATUS',
            status=400,
            errors={'status': [order.status]},
        )
    _assert_row_version(order, expected_row_version)

    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if locked.status not in (Order.Status.PENDING_MANUAL, Order.Status.QUOTED):
            raise OrderServiceError(
                'only pending_manual or quoted orders can be cancelled',
                code='INVALID_STATUS',
                status=400,
                errors={'status': [locked.status]},
            )
        _assert_row_version(locked, expected_row_version)
        locked.status = Order.Status.CANCELLED
        locked.row_version = locked.row_version + 1
        locked.save(update_fields=['status', 'row_version', 'updated_at'])
        return locked
