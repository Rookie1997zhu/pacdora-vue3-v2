from __future__ import annotations

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.errors import BillingError
from apps.billing.models import ExportGrant
from apps.billing.services import (
    consume_export,
    create_upgrade_intent,
    entitlement_for_user,
    serialize_entitlement,
)
from apps.organizations.services import ensure_personal_org
from config.api import ok


def _billing_error(request, exc: BillingError):
    return Response(
        {
            'code': exc.code,
            'message': str(exc),
            'data': exc.data,
            'errors': exc.errors,
            'request_id': getattr(request, 'request_id', None),
        },
        status=exc.status,
    )


class EntitlementView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ent = entitlement_for_user(request.user)
        return ok(serialize_entitlement(ent), request=request)


@method_decorator(csrf_protect, name='dispatch')
class ExportGrantCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        fmt = str(body.get('format') or '').strip().lower()[:16]
        org = ensure_personal_org(request.user)
        try:
            result = consume_export(
                organization=org,
                actor=request.user,
                reason=ExportGrant.Reason.LAB_CLIENT,
                format=fmt,
                meta={'source': 'lab_client'},
            )
        except BillingError as exc:
            return _billing_error(request, exc)
        return ok(
            {
                'grant_id': result['grant_id'],
                'remaining': result['entitlement'].get('remaining'),
                'plan': result['entitlement'].get('plan'),
                'unlimited': result['entitlement'].get('unlimited'),
                'entitlement': result['entitlement'],
            },
            message='export grant issued',
            request=request,
            http_status=201,
        )


@method_decorator(csrf_protect, name='dispatch')
class UpgradeIntentCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        try:
            intent = create_upgrade_intent(
                user=request.user,
                plan=str(body.get('plan') or ''),
                note=str(body.get('note') or ''),
                contact=str(body.get('contact') or ''),
            )
        except BillingError as exc:
            return _billing_error(request, exc)
        return ok(
            {
                'id': str(intent.id),
                'plan': intent.plan,
                'status': intent.status,
                'note': intent.note,
                'contact': intent.contact,
                'created_at': intent.created_at.isoformat(),
            },
            message='upgrade intent submitted (no payment)',
            request=request,
            http_status=201,
        )

