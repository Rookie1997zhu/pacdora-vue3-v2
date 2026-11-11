from rest_framework import serializers

from apps.catalog.models import Product, ProductVariant, TemplateDefinition, TemplateVersion


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ('id', 'code', 'material_id', 'coating', 'min_quantity', 'is_active', 'meta')


class ProductListSerializer(serializers.ModelSerializer):
    template_key = serializers.CharField(source='default_template.template_key')
    geometry_mode = serializers.CharField(source='default_template.geometry_mode')

    class Meta:
        model = Product
        fields = (
            'id',
            'slug',
            'name',
            'name_ko',
            'category',
            'description',
            'status',
            'template_key',
            'geometry_mode',
            'capabilities',
            'cover_rel',
            'sort_order',
        )


class ProductDetailSerializer(ProductListSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    template_version = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ('variants', 'template_version')

    def get_template_version(self, obj):
        ver = obj.default_template_version
        if not ver:
            ver = obj.default_template.versions.filter(is_current=True).first()
        if not ver:
            return None
        return {
            'version': ver.version,
            'engine_version': ver.engine_version,
            'limits': ver.limits,
            'capabilities': ver.capabilities,
        }


class TemplateVersionSerializer(serializers.ModelSerializer):
    template_key = serializers.CharField(source='template.template_key')
    geometry_mode = serializers.CharField(source='template.geometry_mode')

    class Meta:
        model = TemplateVersion
        fields = (
            'id',
            'template_key',
            'geometry_mode',
            'version',
            'engine_version',
            'param_schema',
            'limits',
            'capabilities',
            'is_current',
        )
