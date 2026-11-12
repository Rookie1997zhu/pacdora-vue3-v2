from django.urls import path

from apps.dieline_library.views import (
    AcquisitionJobCreateView,
    AcquisitionJobDetailView,
    AcquisitionPlanValidateView,
    RevisionDownloadView,
    RevisionPreviewView,
    VariantDetailView,
    VariantListView,
)

urlpatterns = [
    path('dieline-library/variants/', VariantListView.as_view()),
    path('dieline-library/variants/<uuid:variant_id>/', VariantDetailView.as_view()),
    path('dieline-library/revisions/<uuid:revision_id>/download/', RevisionDownloadView.as_view()),
    path('dieline-library/revisions/<uuid:revision_id>/preview/', RevisionPreviewView.as_view()),
    path('dieline-library/acquisition-plans/validate/', AcquisitionPlanValidateView.as_view()),
    path('dieline-library/acquisition-jobs/', AcquisitionJobCreateView.as_view()),
    path('dieline-library/acquisition-jobs/<uuid:job_id>/', AcquisitionJobDetailView.as_view()),
]
