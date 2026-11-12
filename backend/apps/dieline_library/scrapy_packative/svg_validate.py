from __future__ import annotations

import re


def is_valid_dieline_svg(text: str) -> tuple[bool, str]:
    if re.search(r'AccessDenied|<Error>\s*<Code>', text, re.I):
        return False, 'access_denied_xml'
    if not re.search(r'<svg[\s>]', text, re.I):
        return False, 'missing_svg_root'
    if not re.search(r'ev-style\s*=\s*"Cutting"', text, re.I):
        return False, 'missing_cutting'
    if not re.search(r'ev-style\s*=\s*"Creasing"', text, re.I):
        return False, 'missing_creasing'
    return True, 'valid_cutting_creasing_svg'
