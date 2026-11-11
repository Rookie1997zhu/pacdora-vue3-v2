from django.urls import path

from apps.assets.views import AssetContentView, AssetDetailView, AssetListCreateView, AssetThumbnailView

urlpatterns = [
    path('assets/', AssetListCreateView.as_view()),
    path('assets/<uuid:asset_id>/', AssetDetailView.as_view()),
    path('assets/<uuid:asset_id>/content/', AssetContentView.as_view()),
    path('assets/<uuid:asset_id>/thumbnail/', AssetThumbnailView.as_view()),
]
