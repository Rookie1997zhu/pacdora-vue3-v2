from django.urls import path

from apps.ai_jobs.views import (
    AiCapabilitiesView,
    AiJobApplyView,
    AiJobCancelView,
    AiJobDetailView,
    DesignAiJobCreateView,
    DesignGeneratedAssetsView,
)

urlpatterns = [
    path('ai/capabilities/', AiCapabilitiesView.as_view()),
    path('designs/<uuid:design_id>/ai-jobs/', DesignAiJobCreateView.as_view()),
    path('designs/<uuid:design_id>/generated-assets/', DesignGeneratedAssetsView.as_view()),
    path('ai-jobs/<uuid:job_id>/', AiJobDetailView.as_view()),
    path('ai-jobs/<uuid:job_id>/cancel/', AiJobCancelView.as_view()),
    path('ai-jobs/<uuid:job_id>/apply/', AiJobApplyView.as_view()),
]
