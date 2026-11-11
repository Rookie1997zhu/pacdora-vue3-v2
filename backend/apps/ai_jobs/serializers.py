from rest_framework import serializers

from apps.ai_jobs.models import AiJob


class AiJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiJob
        fields = (
            'id',
            'design_id',
            'input_revision_id',
            'operation',
            'status',
            'prompt',
            'provider',
            'result_asset_id',
            'error_code',
            'error_message',
            'created_at',
            'updated_at',
            'finished_at',
        )
        read_only_fields = fields
