from __future__ import annotations

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.content.locale import resolve_locale
from config.api import ok


class LocaleHintView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return ok(resolve_locale(request), request=request)
