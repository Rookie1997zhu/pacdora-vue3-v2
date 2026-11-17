from __future__ import annotations

from urllib.parse import urlparse

import markdown as md
import nh3

ALLOWED_TAGS = {
    'a',
    'p',
    'br',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'code',
    'pre',
    'img',
    'hr',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
}

ALLOWED_ATTRIBUTES = {
    'a': {'href', 'title'},
    'img': {'src', 'alt', 'title'},
}


def _safe_url(value: str) -> str | None:
    raw = (value or '').strip()
    if not raw:
        return None
    if raw.startswith('/') and not raw.startswith('//'):
        return raw
    parsed = urlparse(raw)
    if parsed.scheme.lower() == 'https' and parsed.netloc:
        return raw
    return None


def _attribute_filter(tag: str, attr: str, value: str) -> str | None:
    if attr in ('href', 'src'):
        return _safe_url(value)
    return value


def render_markdown(source: str) -> str:
    raw = md.markdown(
        source or '',
        extensions=['extra', 'sane_lists', 'nl2br'],
        output_format='html5',
    )
    return nh3.clean(
        raw,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        attribute_filter=_attribute_filter,
        url_schemes={'https'},
        link_rel='noopener noreferrer',
    )


def sanitize_cover_url(url: str) -> str:
    value = (url or '').strip()
    if value.startswith('https://') and _safe_url(value):
        return value
    return ''
