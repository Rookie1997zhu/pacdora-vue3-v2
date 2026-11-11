from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.catalog.models import Product, TemplateDefinition, TemplateVersion
from apps.catalog.serializers import ProductDetailSerializer, ProductListSerializer, TemplateVersionSerializer
from config.api import fail, ok


class ProductListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        qs = Product.objects.filter(status=Product.Status.PUBLISHED).select_related(
            'default_template',
            'default_template_version',
        ).order_by('sort_order', 'name')
        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        items = ProductListSerializer(qs, many=True).data
        return ok({'items': items, 'page': 1, 'page_size': len(items), 'total': len(items)}, request=request)


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
