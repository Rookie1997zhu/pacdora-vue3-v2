from django.urls import path

from apps.exports.views import (
    DesignExportCreateView,
    ExportJobCancelView,
    ExportJobDetailView,
    ExportJobDownloadView,
    ExportJobListView,
    ExportJobRetryView,
)

urlpatterns = [
    path('designs/<uuid:design_id>/exports/', DesignExportCreateView.as_view()),
    path('exports/', ExportJobListView.as_view()),
    path('exports/<uuid:export_id>/', ExportJobDetailView.as_view()),
    path('exports/<uuid:export_id>/cancel/', ExportJobCancelView.as_view()),
    path('exports/<uuid:export_id>/retry/', ExportJobRetryView.as_view()),
    path('exports/<uuid:export_id>/download/', ExportJobDownloadView.as_view()),
]
