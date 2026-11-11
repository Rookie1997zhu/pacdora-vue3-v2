from django.urls import path

from apps.exports.views import DesignExportCreateView, ExportJobDetailView, ExportJobDownloadView

urlpatterns = [
    path('designs/<uuid:design_id>/exports/', DesignExportCreateView.as_view()),
    path('exports/<uuid:export_id>/', ExportJobDetailView.as_view()),
    path('exports/<uuid:export_id>/download/', ExportJobDownloadView.as_view()),
]
