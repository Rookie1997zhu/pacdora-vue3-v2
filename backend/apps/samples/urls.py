from django.urls import path

from apps.samples.views import (
    SampleTestDetailView,
    SampleTestEvidenceView,
    SampleTestListCreateView,
    SampleTestReviewView,
)

urlpatterns = [
    path('sample-tests/', SampleTestListCreateView.as_view()),
    path('sample-tests/<uuid:sample_id>/', SampleTestDetailView.as_view()),
    path('sample-tests/<uuid:sample_id>/evidence/', SampleTestEvidenceView.as_view()),
    path('sample-tests/<uuid:sample_id>/review/', SampleTestReviewView.as_view()),
]
