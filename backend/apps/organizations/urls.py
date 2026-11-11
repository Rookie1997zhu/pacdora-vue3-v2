from django.urls import path

from apps.organizations.views import OrganizationDetailView, OrganizationListView

urlpatterns = [
    path('organizations/', OrganizationListView.as_view()),
    path('organizations/<uuid:org_id>/', OrganizationDetailView.as_view()),
]
