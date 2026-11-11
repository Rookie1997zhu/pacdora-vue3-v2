from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.orders.services import (
    OrderServiceError,
    add_cart_item,
    apply_manual_quote,
    cancel_order,
    checkout_cart,
    confirm_order,
    get_or_create_active_cart,
    remove_cart_item,
    serialize_cart,
    serialize_cart_item,
    serialize_order,
    update_cart_item,
)
from apps.organizations.permissions import org_ids_for, primary_org, require_org_membership
from config.api import fail, ok


def _service_error(request, exc: OrderServiceError):
    return Response(
        {
            'code': exc.code,
            'message': str(exc),
            'data': exc.data,
            'errors': exc.errors,
            'request_id': getattr(request, 'request_id', None),
        },
        status=exc.status,
    )


class CartDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = primary_org(request.user)
        if not org:
            return fail('无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        cart = get_or_create_active_cart(org)
        return ok(serialize_cart(cart), request=request)


class CartItemCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        org = primary_org(request.user)
        if not org:
            return fail('无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        try:
            item = add_cart_item(
                organization=org,
                user=request.user,
                design_revision_id=request.data.get('design_revision_id'),
                quantity=request.data.get('quantity'),
                quote_id=request.data.get('quote_id'),
            )
        except OrderServiceError as exc:
            return _service_error(request, exc)
        cart = item.cart
        return ok(
            {'item': serialize_cart_item(item), 'cart': serialize_cart(cart)},
            message='已加入购物车',
            request=request,
            http_status=201,
        )


class CartItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, item_id):
        org = primary_org(request.user)
        if not org:
            return fail('无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        try:
            item = update_cart_item(
                organization=org,
                item_id=item_id,
                quantity=request.data.get('quantity'),
            )
        except OrderServiceError as exc:
            return _service_error(request, exc)
        return ok(
            {'item': serialize_cart_item(item), 'cart': serialize_cart(item.cart)},
            request=request,
        )

    def delete(self, request, item_id):
        org = primary_org(request.user)
        if not org:
            return fail('无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        try:
            remove_cart_item(organization=org, item_id=item_id)
        except OrderServiceError as exc:
            return _service_error(request, exc)
        cart = get_or_create_active_cart(org)
        return ok(serialize_cart(cart), message='已移除', request=request)


class OrderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Order.objects.filter(organization_id__in=org_ids_for(request.user))
            .order_by('-created_at')[:100]
        )
        return ok({'items': [serialize_order(o) for o in qs]}, request=request)

    def post(self, request):
        org = primary_org(request.user)
        if not org:
            return fail('无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        idem = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key')
        # Client-supplied totals are intentionally ignored.
        try:
            order, replay = checkout_cart(
                organization=org,
                user=request.user,
                idempotency_key=idem or '',
            )
        except OrderServiceError as exc:
            return _service_error(request, exc)
        return ok(
            serialize_order(order),
            message='幂等重放' if replay else '已下单',
            request=request,
            http_status=200 if replay else 201,
        )


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        order = Order.objects.filter(id=order_id).first()
        if not order or not require_org_membership(request.user, order.organization_id):
            return fail('无权访问订单', code='FORBIDDEN', request=request, http_status=403)
        return ok(serialize_order(order), request=request)


class OrderManualQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        org = primary_org(request.user)
        if not org:
            return fail('无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        try:
            order = apply_manual_quote(
                organization=org,
                user=request.user,
                order_id=order_id,
                expected_row_version=request.data.get('expected_row_version'),
                lines=request.data.get('lines'),
            )
        except OrderServiceError as exc:
            return _service_error(request, exc)
        return ok(serialize_order(order), message='已人工报价', request=request)


class OrderConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        org = primary_org(request.user)
        if not org:
            return fail('无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        try:
            order = confirm_order(
                organization=org,
                order_id=order_id,
                expected_row_version=request.data.get('expected_row_version'),
            )
        except OrderServiceError as exc:
            return _service_error(request, exc)
        return ok(serialize_order(order), message='已确认订单', request=request)


class OrderCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        org = primary_org(request.user)
        if not org:
            return fail('无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        try:
            order = cancel_order(
                organization=org,
                order_id=order_id,
                expected_row_version=request.data.get('expected_row_version'),
            )
        except OrderServiceError as exc:
            return _service_error(request, exc)
        return ok(serialize_order(order), message='已取消订单', request=request)
