from django.urls import path

from apps.geometry_api.views import GeometryValidateView, PackingSolveView

urlpatterns = [
    path('geometry/validate/', GeometryValidateView.as_view()),
    path('packing/solve/', PackingSolveView.as_view()),
]
