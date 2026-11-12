from django.urls import include, path, re_path

from apps.health.not_found import ApiNotFoundView
from config.api import fail

urlpatterns = [
    path('api/v1/', include('apps.health.urls')),
    path('api/v1/', include('apps.accounts.urls')),
    path('api/v1/', include('apps.organizations.urls')),
    path('api/v1/', include('apps.geometry_api.urls')),
    path('api/v1/', include('apps.catalog.urls')),
    path('api/v1/', include('apps.assets.urls')),
    path('api/v1/', include('apps.designs.urls')),
    path('api/v1/', include('apps.ai_jobs.urls')),
    path('api/v1/', include('apps.exports.urls')),
    path('api/v1/', include('apps.quotes.urls')),
    path('api/v1/', include('apps.orders.urls')),
    path('api/v1/', include('apps.dieline_library.urls')),
    path('api/v1/', include('apps.console.urls')),
    re_path(r'^api/v1/.*$', ApiNotFoundView.as_view()),
]


def api_not_found(request, exception=None):
    return fail(
        message='接口不存在',
        code='NOT_FOUND',
        request=request,
        http_status=404,
    )


handler404 = 'config.urls.api_not_found'
