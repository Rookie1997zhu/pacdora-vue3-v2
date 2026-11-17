from django.http import HttpResponseNotFound
from django.urls import include, path, re_path

from apps.health.not_found import ApiNotFoundView
from config.api import fail

urlpatterns = [
    path('', include('apps.content.urls_public')),
    path('api/v1/', include('apps.health.urls')),
    path('api/v1/', include('apps.accounts.urls')),
    path('api/v1/', include('apps.organizations.urls')),
    path('api/v1/', include('apps.geometry_api.urls')),
    path('api/v1/', include('apps.catalog.urls')),
    path('api/v1/', include('apps.assets.urls')),
    path('api/v1/', include('apps.designs.urls')),
    path('api/v1/', include('apps.ai_jobs.urls')),
    path('api/v1/', include('apps.exports.urls')),
    path('api/v1/', include('apps.samples.urls')),
    path('api/v1/', include('apps.quotes.urls')),
    path('api/v1/', include('apps.orders.urls')),
    path('api/v1/', include('apps.dieline_library.urls')),
    path('api/v1/', include('apps.billing.urls')),
    path('api/v1/', include('apps.content.urls_api')),
    path('api/v1/', include('apps.console.urls')),
    path('api/v1/', include('apps.render_scenes.urls')),
    re_path(r'^api/v1/.*$', ApiNotFoundView.as_view()),
]


def api_not_found(request, exception=None):
    path = request.path or ''
    if path.startswith('/api/'):
        return fail(
            message='接口不存在',
            code='NOT_FOUND',
            request=request,
            http_status=404,
        )
    return HttpResponseNotFound('<h1>Not Found</h1>', content_type='text/html; charset=utf-8')


handler404 = 'config.urls.api_not_found'
