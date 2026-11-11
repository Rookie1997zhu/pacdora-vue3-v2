from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.permissions import primary_org, require_org_membership
from apps.quotes.models import Quote
from apps.quotes.services import QuoteServiceError, create_quote, serialize_quote
from config.api import fail, ok


def _service_error(request, exc: QuoteServiceError):
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


def _get_quote(user, quote_id) -> Quote | None:
    quote = Quote.objects.select_related(
        'organization',
        'design',
        'design_revision',
        'product',
        'rule_version',
    ).filter(id=quote_id).first()
    if not quote or not require_org_membership(user, quote.organization_id):
        return None
    return quote


class QuoteListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        org = primary_org(request.user)
        if not org:
            return fail('无组织', code='NO_ORGANIZATION', request=request, http_status=400)
        revision_id = request.data.get('design_revision_id')
        quantity = request.data.get('quantity')
        # Client-supplied totals are intentionally ignored.
        try:
            quote = create_quote(
                organization=org,
                user=request.user,
                design_revision_id=revision_id,
                quantity=quantity,
            )
        except QuoteServiceError as exc:
            return _service_error(request, exc)
        return ok(serialize_quote(quote), message='已创建报价', request=request, http_status=201)


class QuoteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, quote_id):
        quote = _get_quote(request.user, quote_id)
        if not quote:
            return fail('无权访问报价', code='FORBIDDEN', request=request, http_status=403)
        return ok(serialize_quote(quote), request=request)
