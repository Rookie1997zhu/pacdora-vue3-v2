from __future__ import annotations

from decimal import Decimal, InvalidOperation

from apps.catalog.models import TemplateApproval, TemplateVersion


def _as_decimal(value) -> Decimal | None:
    if value is None or value == '':
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def find_template_approval(
    template_version: TemplateVersion,
    material_id: str,
    thickness_mm,
) -> TemplateApproval | None:
    """Return the first matching approved TemplateApproval for material/thickness envelope."""
    material = (material_id or '').strip() or 'kraft'
    thickness = _as_decimal(thickness_mm)
    qs = TemplateApproval.objects.filter(template_version=template_version, approved=True).order_by(
        '-approved_at',
        '-created_at',
    )
    for approval in qs:
        allowed = approval.material_ids if isinstance(approval.material_ids, list) else []
        if allowed and material not in allowed:
            continue
        t_min = approval.thickness_min_mm
        t_max = approval.thickness_max_mm
        if thickness is not None:
            if t_min is not None and thickness < t_min:
                continue
            if t_max is not None and thickness > t_max:
                continue
        elif t_min is not None or t_max is not None:
            # thickness unknown but approval constrains thickness → no match
            continue
        return approval
    return None
