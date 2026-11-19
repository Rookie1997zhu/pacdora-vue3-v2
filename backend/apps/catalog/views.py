from urllib.parse import quote

from django.core.cache import cache
from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.catalog.models import MaterialProfile, Product, TemplateVersion
from apps.catalog.serializers import (
    MaterialProfileSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    TemplateVersionSerializer,
)
from apps.console.pagination import paginate_queryset
from config.api import fail, ok

PRODUCTS_CACHE_TTL = 60
MATERIALS_CACHE_TTL = 300


def _cache_token(value: str) -> str:
    return quote(value or '', safe='')


class ProductListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        category = (request.query_params.get('category') or '').strip()
        q = (request.query_params.get('q') or '').strip()
        page = request.query_params.get('page') or '1'
        size = request.query_params.get('page_size') or '24'
        cache_key = (
            f'pub:products:v1:cat={_cache_token(category)}:q={_cache_token(q)}'
            f':p={_cache_token(str(page))}:s={_cache_token(str(size))}'
        )
        payload = cache.get(cache_key)
        if payload is None:
            qs = Product.objects.filter(status=Product.Status.PUBLISHED).select_related(
                'default_template',
                'default_template_version',
            ).order_by('sort_order', 'name')
            if category:
                qs = qs.filter(category=category)
            if q:
                qs = qs.filter(Q(name__icontains=q) | Q(name_ko__icontains=q) | Q(slug__icontains=q))
            page_items, meta = paginate_queryset(qs, request, default_size=24, max_size=100)
            items = ProductListSerializer(page_items, many=True).data
            categories = list(
                Product.objects.filter(status=Product.Status.PUBLISHED)
                .exclude(category='')
                .values_list('category', flat=True)
                .distinct()
                .order_by('category')
            )
            payload = {**meta, 'items': items, 'categories': categories}
            cache.set(cache_key, payload, PRODUCTS_CACHE_TTL)
        return ok(payload, request=request)


class ProductDetailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        product = (
            Product.objects.filter(slug=slug, status=Product.Status.PUBLISHED)
            .select_related('default_template', 'default_template_version')
            .prefetch_related('variants')
            .first()
        )
        if not product:
            return fail('产品不存在', code='NOT_FOUND', request=request, http_status=404)
        return ok(ProductDetailSerializer(product).data, request=request)


class TemplateVersionDetailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, template_key, version):
        row = (
            TemplateVersion.objects.select_related('template')
            .filter(template__template_key=template_key, version=version)
            .first()
        )
        if not row:
            return fail('模板版本不存在', code='NOT_FOUND', request=request, http_status=404)
        return ok(TemplateVersionSerializer(row).data, request=request)


class MaterialProfileListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        include_legacy = request.query_params.get('include_legacy') in ('1', 'true', 'yes')
        cache_key = f'pub:materials:v1:legacy={int(include_legacy)}'
        payload = cache.get(cache_key)
        if payload is None:
            qs = MaterialProfile.objects.filter(is_active=True).order_by('family', 'code')
            if not include_legacy:
                qs = qs.exclude(code__in=('kraft', 'white', 'blue'))
            items = MaterialProfileSerializer(qs, many=True).data
            payload = {'items': items, 'total': len(items)}
            cache.set(cache_key, payload, MATERIALS_CACHE_TTL)
        return ok(payload, request=request)
