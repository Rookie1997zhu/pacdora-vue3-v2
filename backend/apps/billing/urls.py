from django.urls import path

from apps.billing import views

urlpatterns = [
    path('billing/entitlement/', views.EntitlementView.as_view()),
    path('billing/export-grants/', views.ExportGrantCreateView.as_view()),
    path('billing/upgrade-intents/', views.UpgradeIntentCreateView.as_view()),
]
