from rest_framework import serializers

from apps.assets.models import Asset
from apps.assets.preview import asset_thumbnail_ready


class AssetSerializer(serializers.ModelSerializer):
    thumbnail_ready = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = (
            'id',
            'organization_id',
            'original_filename',
            'mime',
            'byte_size',
            'sha256',
            'width_px',
            'height_px',
            'status',
            'source',
            'thumbnail_ready',
            'created_at',
        )
        read_only_fields = fields

    def get_thumbnail_ready(self, obj):
        return asset_thumbnail_ready(str(obj.id))
