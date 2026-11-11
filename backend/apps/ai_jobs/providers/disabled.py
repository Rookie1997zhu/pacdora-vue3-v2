from apps.ai_jobs.providers.base import BaseImageProvider, ProviderError


class DisabledProvider(BaseImageProvider):
    name = 'disabled'

    def generate_image(self, prompt: str, **meta) -> bytes:
        raise ProviderError('AI provider disabled', code='CAPABILITY_UNAVAILABLE', status=400)
