from django.urls import path

from apps.designs.views import (
    DesignCopyView,
    DesignDetailView,
    DesignListCreateView,
    DesignRevisionListCreateView,
    DesignViewPreferenceView,
    RevisionDetailView,
)

urlpatterns = [
    path('designs/', DesignListCreateView.as_view()),
    path('designs/<uuid:design_id>/', DesignDetailView.as_view()),
    path('designs/<uuid:design_id>/revisions/', DesignRevisionListCreateView.as_view()),
    path('designs/<uuid:design_id>/copy/', DesignCopyView.as_view()),
    path('designs/<uuid:design_id>/view-preference/', DesignViewPreferenceView.as_view()),
    path('revisions/<uuid:revision_id>/', RevisionDetailView.as_view()),
]
