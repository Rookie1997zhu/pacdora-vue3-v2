from __future__ import annotations

import base64

import requests
from django.conf import settings

from apps.ai_jobs.providers.base import BaseImageProvider, ProviderError


class GeminiImagesProvider(BaseImageProvider):
    name = 'gemini'

    def generate_image(self, prompt: str, **meta) -> bytes:
        key = (getattr(settings, 'AI_API_KEY', '') or '').strip()
        if not key:
            raise ProviderError('missing AI_API_KEY', code='CAPABILITY_UNAVAILABLE', status=400)
        model = (getattr(settings, 'AI_MODEL', '') or 'gemini-2.5-flash-image').strip()
        base = (
            getattr(
                settings,
                'AI_GEMINI_BASE_URL',
                'https://generativelanguage.googleapis.com/v1beta',
            )
            or 'https://generativelanguage.googleapis.com/v1beta'
        ).rstrip('/')
        url = f'{base}/models/{model}:generateContent'

        parts: list[dict] = [{'text': prompt}]
        mask_png = meta.get('mask_png')
        if mask_png:
            mime = (meta.get('mask_mime') or 'image/png').strip() or 'image/png'
            if isinstance(mask_png, (bytes, bytearray)):
                b64 = base64.b64encode(bytes(mask_png)).decode('ascii')
            else:
                raise ProviderError('mask_png must be bytes', code='VALIDATION_ERROR', status=400)
            parts.append({'inlineData': {'mimeType': mime, 'data': b64}})

        try:
            resp = requests.post(
                url,
                headers={'x-goog-api-key': key, 'Content-Type': 'application/json'},
                json={
                    'contents': [{'role': 'user', 'parts': parts}],
                    'generationConfig': {
                        'responseModalities': ['TEXT', 'IMAGE'],
                    },
                },
                timeout=90,
            )
        except requests.RequestException as exc:
            raise ProviderError(
                f'gemini unreachable: {exc}',
                code='PROVIDER_UNAVAILABLE',
                status=503,
            ) from exc
        if resp.status_code >= 400:
            raise ProviderError(
                f'gemini rejected: {resp.status_code}',
                code='PROVIDER_REJECTED',
                status=502,
            )
        try:
            data = resp.json()
        except ValueError as exc:
            raise ProviderError(
                'gemini invalid json',
                code='PROVIDER_BAD_RESPONSE',
                status=502,
            ) from exc

        for cand in data.get('candidates') or []:
            content = cand.get('content') or {}
            for part in content.get('parts') or []:
                inline = part.get('inlineData') or part.get('inline_data')
                if not inline:
                    continue
                b64 = inline.get('data')
                if b64:
                    try:
                        return base64.b64decode(b64)
                    except (TypeError, ValueError) as exc:
                        raise ProviderError(
                            'gemini invalid image payload',
                            code='PROVIDER_BAD_RESPONSE',
                            status=502,
                        ) from exc
        raise ProviderError(
            'gemini missing image payload',
            code='PROVIDER_BAD_RESPONSE',
            status=502,
        )
