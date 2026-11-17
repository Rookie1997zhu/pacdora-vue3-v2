from rest_framework import serializers

from apps.assets.models import AssetDerivative
from apps.assets.preview import preview_fields_for_content
from apps.designs.models import Design, DesignRevision
from apps.designs.tasks import DIELINE_KIND


class DesignListSerializer(serializers.ModelSerializer):
    product_slug = serializers.CharField(source='product.slug', read_only=True, allow_null=True)
    preview_asset_id = serializers.SerializerMethodField()
    thumbnail_ready = serializers.SerializerMethodField()
    dieline_thumbnail_ready = serializers.SerializerMethodField()
    dieline_preview_asset_id = serializers.SerializerMethodField()

    class Meta:
        model = Design
        fields = (
            'id',
            'name',
            'status',
            'row_version',
            'product_slug',
            'current_revision_id',
            'preview_asset_id',
            'thumbnail_ready',
            'dieline_thumbnail_ready',
            'dieline_preview_asset_id',
            'updated_at',
            'created_at',
        )

    def _preview(self, obj):
        cache = self.context.setdefault('_preview_cache', {})
        key = str(obj.pk)
        if key not in cache:
            content = None
            if obj.current_revision_id:
                content = obj.current_revision.content_json
            cache[key] = preview_fields_for_content(content)
        return cache[key]

    def get_preview_asset_id(self, obj):
        return self._preview(obj)['preview_asset_id']

    def get_thumbnail_ready(self, obj):
        return self._preview(obj)['thumbnail_ready']

    def get_dieline_preview_asset_id(self, obj):
        return str(obj.dieline_preview_asset_id) if obj.dieline_preview_asset_id else None

    def get_dieline_thumbnail_ready(self, obj):
        if not obj.dieline_preview_asset_id:
            return False
        return AssetDerivative.objects.filter(asset_id=obj.dieline_preview_asset_id, kind=DIELINE_KIND).exists()


class DesignDetailSerializer(DesignListSerializer):
    content = serializers.SerializerMethodField()
    current_revision_no = serializers.SerializerMethodField()
    param_limits = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()

    class Meta(DesignListSerializer.Meta):
        fields = DesignListSerializer.Meta.fields + (
            'content',
            'current_revision_no',
            'organization_id',
            'param_limits',
            'capabilities',
        )

    def get_content(self, obj):
        if obj.current_revision_id:
            return obj.current_revision.content_json
        return None

    def get_current_revision_no(self, obj):
        if obj.current_revision_id:
            return obj.current_revision.revision_no
        return None

    def get_param_limits(self, obj):
        product = getattr(obj, 'product', None)
        if not product:
            return {}
        ver = product.default_template_version
        if not ver:
            return {}
        limits = ver.limits or {}
        return limits if isinstance(limits, dict) else {}

    def get_capabilities(self, obj):
        product = getattr(obj, 'product', None)
        merged = {}
        if product and isinstance(product.capabilities, dict):
            merged.update(product.capabilities)
        ver = getattr(product, 'default_template_version', None) if product else None
        if ver and isinstance(ver.capabilities, dict):
            merged.update(ver.capabilities)
        return {
            'editable_size': bool(merged.get('editable_size')),
            'canExportManufacturing': bool(merged.get('canExportManufacturing')),
            'geometry_mode': merged.get('geometry_mode') or None,
        }


class DesignRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DesignRevision
        fields = (
            'id',
            'revision_no',
            'schema_version',
            'content_hash',
            'geometry_hash',
            'template_version',
            'engine_version',
            'created_at',
        )
