from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.geometry_api.client import GeometryServiceError, solve_packing, validate_geometry
from config.api import fail, ok


class GeometryValidateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            data = validate_geometry(request.data if isinstance(request.data, dict) else {})
        except GeometryServiceError as exc:
            return fail(
                str(exc),
                code=exc.code,
                errors=exc.payload,
                request=request,
                http_status=exc.status_code,
            )
        return ok(data, request=request)


class PackingSolveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            data = solve_packing(request.data if isinstance(request.data, dict) else {})
        except GeometryServiceError as exc:
            return fail(
                str(exc),
                code=exc.code,
                errors=exc.payload,
                request=request,
                http_status=exc.status_code,
            )
        return ok(data, request=request)
