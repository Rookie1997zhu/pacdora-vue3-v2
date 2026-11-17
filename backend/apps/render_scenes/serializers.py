from rest_framework import serializers

from apps.render_scenes.models import (
    RenderBatch,
    RenderEnvironment,
    RenderJob,
    RenderProp,
    RenderScene,
    RenderSceneTemplate,
)


class RenderSceneListSerializer(serializers.ModelSerializer):
    cover_asset_id = serializers.SerializerMethodField()
    model_count = serializers.SerializerMethodField()
    prop_count = serializers.SerializerMethodField()

    class Meta:
        model = RenderScene
        fields = (
            'id',
            'name',
            'row_version',
            'schema_version',
            'cover_asset_id',
            'model_count',
            'prop_count',
            'updated_at',
            'created_at',
        )

    def get_cover_asset_id(self, obj):
        return str(obj.cover_asset_id) if obj.cover_asset_id else None

    def get_model_count(self, obj):
        content = obj.content_json if isinstance(obj.content_json, dict) else {}
        models = content.get('models') or []
        return len(models) if isinstance(models, list) else 0

    def get_prop_count(self, obj):
        content = obj.content_json if isinstance(obj.content_json, dict) else {}
        props = content.get('props') or []
        return len(props) if isinstance(props, list) else 0


class RenderSceneDetailSerializer(RenderSceneListSerializer):
    content = serializers.SerializerMethodField()
    organization_id = serializers.UUIDField(read_only=True)

    class Meta(RenderSceneListSerializer.Meta):
        fields = RenderSceneListSerializer.Meta.fields + (
            'content',
            'organization_id',
        )

    def get_content(self, obj):
        return obj.content_json


class RenderJobSerializer(serializers.ModelSerializer):
    result_asset_id = serializers.SerializerMethodField()
    input_asset_id = serializers.SerializerMethodField()
    batch_id = serializers.SerializerMethodField()

    class Meta:
        model = RenderJob
        fields = (
            'id',
            'scene_id',
            'batch_id',
            'view_id',
            'status',
            'width',
            'height',
            'format',
            'result_asset_id',
            'input_asset_id',
            'checksum',
            'error_code',
            'error_message',
            'samples',
            'duration_ms',
            'created_at',
            'updated_at',
            'finished_at',
        )

    def get_result_asset_id(self, obj):
        return str(obj.result_asset_id) if obj.result_asset_id else None

    def get_input_asset_id(self, obj):
        return str(obj.input_asset_id) if obj.input_asset_id else None

    def get_batch_id(self, obj):
        return str(obj.batch_id) if obj.batch_id else None


class RenderBatchSerializer(serializers.ModelSerializer):
    job_ids = serializers.SerializerMethodField()

    class Meta:
        model = RenderBatch
        fields = (
            'id',
            'scene_id',
            'status',
            'width',
            'height',
            'format',
            'view_ids',
            'job_count',
            'succeeded_count',
            'failed_count',
            'job_ids',
            'error_code',
            'error_message',
            'created_at',
            'updated_at',
            'finished_at',
        )

    def get_job_ids(self, obj):
        return [str(j) for j in obj.jobs.order_by('created_at').values_list('id', flat=True)]


class RenderPropSerializer(serializers.ModelSerializer):
    asset_id = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = RenderProp
        fields = (
            'id',
            'name',
            'slug',
            'source',
            'is_official',
            'asset_id',
            'download_url',
            'created_at',
            'updated_at',
        )

    def get_asset_id(self, obj):
        return str(obj.asset_id) if obj.asset_id else None

    def get_download_url(self, obj):
        return f'/api/v1/render-props/{obj.id}/download/'


class RenderEnvironmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = RenderEnvironment
        fields = (
            'id',
            'name',
            'default_intensity',
            'download_url',
            'sort_order',
        )

    def get_download_url(self, obj):
        return f'/api/v1/render-environments/{obj.id}/download/'


class RenderSceneTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RenderSceneTemplate
        fields = (
            'id',
            'name',
            'tier',
            'slot_ids',
            'sort_order',
            'content_json',
        )
