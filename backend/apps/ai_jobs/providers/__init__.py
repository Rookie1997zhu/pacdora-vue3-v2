from django.conf import settings

from apps.ai_jobs.providers.base import ProviderError
from apps.ai_jobs.providers.disabled import DisabledProvider
from apps.ai_jobs.providers.gemini_images import GeminiImagesProvider
from apps.ai_jobs.providers.openai_images import OpenAIImagesProvider
from apps.ai_jobs.providers.test import TestProvider


def get_provider():
    name = (getattr(settings, 'AI_PROVIDER', 'disabled') or 'disabled').strip().lower()
    if name in ('', 'disabled'):
        return DisabledProvider()
    if name == 'test':
        return TestProvider()
    if name in ('openai', 'openai_images'):
        return OpenAIImagesProvider()
    if name in ('gemini', 'gemini_images'):
        return GeminiImagesProvider()
    raise ProviderError(f'unknown provider: {name}', code='CAPABILITY_UNAVAILABLE')
