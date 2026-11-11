from django.urls import path

from apps.orders.views import (
    CartDetailView,
    CartItemCreateView,
    CartItemDetailView,
    OrderCancelView,
    OrderConfirmView,
    OrderDetailView,
    OrderListCreateView,
    OrderManualQuoteView,
)

urlpatterns = [
    path('cart/', CartDetailView.as_view()),
    path('cart/items/', CartItemCreateView.as_view()),
    path('cart/items/<uuid:item_id>/', CartItemDetailView.as_view()),
    path('orders/', OrderListCreateView.as_view()),
    path('orders/<uuid:order_id>/', OrderDetailView.as_view()),
    path('orders/<uuid:order_id>/manual-quote/', OrderManualQuoteView.as_view()),
    path('orders/<uuid:order_id>/confirm/', OrderConfirmView.as_view()),
    path('orders/<uuid:order_id>/cancel/', OrderCancelView.as_view()),
]
