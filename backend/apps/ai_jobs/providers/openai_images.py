from __future__ import annotations

import base64

import requests
from apps.ai_jobs.capabilities import api_key, model_name, openai_images_url
from apps.ai_jobs.providers.base import BaseImageProvider, ProviderError


class OpenAIImagesProvider(BaseImageProvider):
    name = 'openai'

    def generate_image(self, prompt: str, **meta) -> bytes:
        key = api_key()
        if not key:
            raise ProviderError('missing AI_API_KEY', code='CAPABILITY_UNAVAILABLE', status=400)
        model = (model_name() or 'gpt-image-1').strip()
        url = openai_images_url()
        try:
            resp = requests.post(
                url,
                headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
                json={
                    'model': model,
                    'prompt': prompt,
                    'size': meta.get('size') or '1024x1024',
                    'n': 1,
                },
                timeout=60,
            )
        except requests.RequestException as exc:
            raise ProviderError(f'openai unreachable: {exc}', code='PROVIDER_UNAVAILABLE', status=503) from exc
        if resp.status_code >= 400:
            raise ProviderError(
                f'openai rejected: {resp.status_code}',
                code='PROVIDER_REJECTED',
                status=502,
            )
        data = resp.json()
        items = data.get('data') or []
        if not items:
            raise ProviderError('openai empty response', code='PROVIDER_BAD_RESPONSE', status=502)
        item = items[0]
        if item.get('b64_json'):
            return base64.b64decode(item['b64_json'])
        image_url = item.get('url')
        if not image_url:
            raise ProviderError('openai missing image payload', code='PROVIDER_BAD_RESPONSE', status=502)
        try:
            img = requests.get(image_url, timeout=60)
        except requests.RequestException as exc:
            raise ProviderError(f'openai image download failed: {exc}', code='PROVIDER_UNAVAILABLE', status=503) from exc
        if img.status_code >= 400:
            raise ProviderError('openai image download rejected', code='PROVIDER_REJECTED', status=502)
        return img.content
