from __future__ import annotations

import io
import re
from xml.etree import ElementTree as ET

# Event / script patterns that must not appear in preview SVG.
_EVENT_ATTR = re.compile(r'^on', re.I)
_HTML_LOGIN_HINTS = (
    b'<!doctype html',
    b'<html',
    b'<script',
    b'login',
    b'sign in',
)


class SvgSanitizeError(Exception):
    def __init__(self, message: str, code: str = 'SVG_UNSAFE'):
        super().__init__(message)
        self.code = code


def looks_like_html_login_page(data: bytes) -> bool:
    low = data[:4096].lower()
    if b'<svg' in low and b'<html' not in low:
        return False
    return any(h in low for h in (b'<!doctype html', b'<html'))


def sanitize_svg_bytes(data: bytes) -> bytes:
    if not data:
        raise SvgSanitizeError('empty svg', code='EMPTY_FILE')
    if looks_like_html_login_page(data):
        raise SvgSanitizeError('html login page disguised as svg', code='PSEUDO_SVG')
    text = data.decode('utf-8', errors='replace')
    if re.search(r'<script[\s>]', text, re.I):
        raise SvgSanitizeError('script element present', code='SVG_SCRIPT')
    try:
        # Forbid external entities by default in ElementTree; still strip handlers.
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise SvgSanitizeError(f'invalid svg xml: {exc}', code='SVG_PARSE') from exc

    dangerous_tags = {'script', 'foreignObject', 'iframe', 'object', 'embed'}
    for el in list(root.iter()):
        tag = el.tag.rsplit('}', 1)[-1] if isinstance(el.tag, str) else ''
        if tag.lower() in dangerous_tags:
            raise SvgSanitizeError(f'dangerous element: {tag}', code='SVG_UNSAFE')
        for attr in list(el.attrib):
            local = attr.rsplit('}', 1)[-1]
            if _EVENT_ATTR.match(local):
                del el.attrib[attr]
                continue
            val = (el.attrib.get(attr) or '').strip().lower()
            if local.lower() in ('href', 'xlink:href') or local.endswith('href'):
                if val.startswith(('javascript:', 'data:text/html', 'http://', 'https://')):
                    del el.attrib[attr]

    buf = io.BytesIO()
    tree = ET.ElementTree(root)
    tree.write(buf, encoding='utf-8', xml_declaration=True)
    return buf.getvalue()
