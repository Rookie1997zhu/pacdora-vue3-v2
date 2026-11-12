from __future__ import annotations

from django.conf import settings
from django.core import signing

_SALT = 'boxcraft.ai-provider-config.v1'


def encrypt_api_key(raw: str) -> str:
    raw = (raw or '').strip()
    if not raw:
        return ''
    return signing.dumps(raw, salt=_SALT)


def decrypt_api_key(token: str) -> str:
    token = (token or '').strip()
    if not token:
        return ''
    try:
        return str(signing.loads(token, salt=_SALT))
    except signing.BadSignature:
        return ''


def mask_api_key(raw: str) -> str:
    raw = (raw or '').strip()
    if not raw:
        return ''
    if len(raw) <= 4:
        return '****'
    return f'****{raw[-4:]}'


def get_or_create_config():
    from apps.ai_jobs.models import AiProviderConfig

    obj, _ = AiProviderConfig.objects.get_or_create(pk=1)
    return obj


def resolved_settings() -> dict:
    """Merge DB singleton over env defaults. Empty DB fields fall back to env."""
    from apps.ai_jobs.models import AiProviderConfig

    env = {
        'provider': (getattr(settings, 'AI_PROVIDER', 'disabled') or 'disabled').strip().lower(),
        'api_key': (getattr(settings, 'AI_API_KEY', '') or '').strip(),
        'model': (getattr(settings, 'AI_MODEL', '') or '').strip(),
        'gemini_base_url': (
            getattr(settings, 'AI_GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')
            or 'https://generativelanguage.googleapis.com/v1beta'
        ).strip(),
        'openai_images_url': (
            getattr(settings, 'AI_OPENAI_IMAGES_URL', 'https://api.openai.com/v1/images/generations')
            or 'https://api.openai.com/v1/images/generations'
        ).strip(),
        'source': 'env',
    }
    try:
        row = AiProviderConfig.objects.filter(pk=1).first()
    except Exception:  # noqa: BLE001 — table may not exist during early migrate
        return env
    if not row:
        return env

    db_key = decrypt_api_key(row.api_key_encrypted)
    provider = (row.provider or '').strip().lower() or env['provider']
    model = (row.model or '').strip() or env['model']
    gemini = (row.gemini_base_url or '').strip() or env['gemini_base_url']
    openai = (row.openai_images_url or '').strip() or env['openai_images_url']
    api_key = db_key or env['api_key']
    used_db = bool(row.provider or row.api_key_encrypted or row.model or row.gemini_base_url or row.openai_images_url)
    return {
        'provider': provider,
        'api_key': api_key,
        'model': model,
        'gemini_base_url': gemini,
        'openai_images_url': openai,
        'source': 'db' if used_db else 'env',
        'has_db_key': bool(db_key),
    }


def serialize_config_public() -> dict:
    cfg = resolved_settings()
    row = None
    try:
        from apps.ai_jobs.models import AiProviderConfig

        row = AiProviderConfig.objects.filter(pk=1).first()
    except Exception:  # noqa: BLE001
        row = None
    raw_key = cfg.get('api_key') or ''
    return {
        'provider': cfg['provider'],
        'model': cfg['model'] or None,
        'gemini_base_url': cfg['gemini_base_url'],
        'openai_images_url': cfg['openai_images_url'],
        'has_api_key': bool(raw_key),
        'api_key_masked': mask_api_key(raw_key) if raw_key else '',
        'source': cfg.get('source') or 'env',
        'updated_at': row.updated_at.isoformat() if row and row.updated_at else None,
        'updated_by': str(row.updated_by_id) if row and row.updated_by_id else None,
    }
