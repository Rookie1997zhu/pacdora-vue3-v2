from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from config.api import ok


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        db_ok = True
        try:
            connection.ensure_connection()
        except Exception:
            db_ok = False
        return ok(
            {
                'service': 'boxcraft-backend',
                'database': 'ok' if db_ok else 'error',
            },
            message='healthy' if db_ok else 'degraded',
            request=request,
            http_status=200 if db_ok else 503,
        )
