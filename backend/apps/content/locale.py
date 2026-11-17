from __future__ import annotations

from django.conf import settings

LOCALES = ('zh-CN', 'ko-KR')
LOCALE_COOKIE = 'boxcraft_locale'
DEFAULT_LOCALE = 'zh-CN'
LANG_PATH = {
    'zh-CN': 'zh',
    'ko-KR': 'ko',
}
PATH_TO_LOCALE = {v: k for k, v in LANG_PATH.items()}


def normalize_locale(value: str | None) -> str | None:
    raw = (value or '').strip()
    if raw in LOCALES:
        return raw
    lower = raw.lower().replace('_', '-')
    if lower.startswith('ko'):
        return 'ko-KR'
    if lower.startswith('zh'):
        return 'zh-CN'
    return None


def parse_accept_language(header: str | None) -> str | None:
    if not header:
        return None
    parts = []
    for item in header.split(','):
        token = item.strip()
        if not token:
            continue
        lang, _, rest = token.partition(';')
        q = 1.0
        if rest.startswith('q='):
            try:
                q = float(rest[2:])
            except ValueError:
                q = 0.0
        parts.append((lang.strip(), q))
    parts.sort(key=lambda x: x[1], reverse=True)
    for lang, _q in parts:
        loc = normalize_locale(lang)
        if loc:
            return loc
    return None


def country_from_request(request) -> str | None:
    header = getattr(settings, 'GEO_COUNTRY_HEADER', 'CF-IPCountry') or 'CF-IPCountry'
    # Django META uses HTTP_ prefix and dashes → underscores
    meta_key = 'HTTP_' + header.upper().replace('-', '_')
    raw = request.META.get(meta_key) or request.headers.get(header)
    if not raw:
        return None
    return str(raw).strip().upper() or None


def resolve_locale(request) -> dict:
    cookie = normalize_locale(request.COOKIES.get(LOCALE_COOKIE))
    if cookie:
        return {
            'locale': cookie,
            'source': 'cookie',
            'country': country_from_request(request),
        }

    country = country_from_request(request)
    if country == 'KR':
        return {'locale': 'ko-KR', 'source': 'country', 'country': country}

    accept = parse_accept_language(request.headers.get('Accept-Language'))
    if accept:
        return {'locale': accept, 'source': 'accept_language', 'country': country}

    return {'locale': DEFAULT_LOCALE, 'source': 'default', 'country': country}


def locale_to_path(locale: str) -> str:
    return LANG_PATH.get(locale, 'zh')


def path_to_locale(lang: str) -> str | None:
    return PATH_TO_LOCALE.get((lang or '').strip().lower())
