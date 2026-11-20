from rest_framework import serializers

from apps.catalog.models import MaterialProfile, Product, ProductVariant, TemplateDefinition, TemplateVersion
from apps.catalog.workbench import build_workbench_payload


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
            'status',
            'template_key',
            'geometry_mode',
            'cover_rel',
            'sort_order',
        )


class ProductDetailSerializer(ProductListSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    template_version = serializers.SerializerMethodField()
    workbench = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + (
            'description',
            'capabilities',
            'variants',
            'template_version',
            'workbench',
        )

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

    def get_workbench(self, obj):
        return build_workbench_payload(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('workbench') is None:
            data.pop('workbench', None)
        return data


class MaterialProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialProfile
        fields = (
            'code',
            'name_zh',
            'name_ko',
            'family',
            'flute',
            'thickness_min',
            'thickness_default',
            'thickness_max',
            'engine_material_id',
            'calibrated',
            'profile_version',
            'is_active',
        )


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
