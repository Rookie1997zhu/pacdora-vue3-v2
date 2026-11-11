from django.urls import path

from apps.catalog.views import ProductDetailView, ProductListView, TemplateVersionDetailView

urlpatterns = [
    path('products/', ProductListView.as_view()),
    path('products/<slug:slug>/', ProductDetailView.as_view()),
    path('templates/<str:template_key>/versions/<str:version>/', TemplateVersionDetailView.as_view()),
]
