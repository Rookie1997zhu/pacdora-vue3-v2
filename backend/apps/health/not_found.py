from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from config.api import fail


class ApiNotFoundView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def _missing(self, request, *args, **kwargs):
        return fail('接口不存在', code='NOT_FOUND', request=request, http_status=404)

    get = _missing
    post = _missing
    put = _missing
    patch = _missing
    delete = _missing
    head = _missing
    options = _missing
