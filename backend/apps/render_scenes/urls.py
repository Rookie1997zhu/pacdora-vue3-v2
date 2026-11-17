from django.urls import path

from apps.render_scenes.views import (
    RenderBatchCreateView,
    RenderBatchDetailView,
    RenderEnvironmentDownloadView,
    RenderEnvironmentListView,
    RenderJobCreateView,
    RenderJobDetailView,
    RenderJobDownloadView,
    RenderPropDetailView,
    RenderPropDownloadView,
    RenderPropListCreateView,
    RenderSceneApplyTemplateView,
    RenderSceneCopyView,
    RenderSceneDetailView,
    RenderSceneListCreateView,
    RenderSceneTemplateDetailView,
    RenderSceneTemplateListView,
)

urlpatterns = [
    path('render-scenes/', RenderSceneListCreateView.as_view()),
    path('render-scenes/<uuid:scene_id>/', RenderSceneDetailView.as_view()),
    path('render-scenes/<uuid:scene_id>/copy/', RenderSceneCopyView.as_view()),
    path('render-scenes/<uuid:scene_id>/apply-template/', RenderSceneApplyTemplateView.as_view()),
    path('render-scenes/<uuid:scene_id>/render-jobs/', RenderJobCreateView.as_view()),
    path('render-scenes/<uuid:scene_id>/render-batches/', RenderBatchCreateView.as_view()),
    path('render-batches/<uuid:batch_id>/', RenderBatchDetailView.as_view()),
    path('render-jobs/<uuid:job_id>/', RenderJobDetailView.as_view()),
    path('render-jobs/<uuid:job_id>/download/', RenderJobDownloadView.as_view()),
    path('render-props/', RenderPropListCreateView.as_view()),
    path('render-props/<uuid:prop_id>/', RenderPropDetailView.as_view()),
    path('render-props/<uuid:prop_id>/download/', RenderPropDownloadView.as_view()),
    path('render-environments/', RenderEnvironmentListView.as_view()),
    path('render-environments/<str:env_id>/download/', RenderEnvironmentDownloadView.as_view()),
    path('render-scene-templates/', RenderSceneTemplateListView.as_view()),
    path('render-scene-templates/<str:template_id>/', RenderSceneTemplateDetailView.as_view()),
]
