from __future__ import annotations

from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import models
from django.utils import timezone

from apps.designs.document import content_hash
from apps.designs.models import DesignRevision
from apps.quotes.models import PricingRuleVersion, Quote


class QuoteServiceError(Exception):
    def __init__(self, message, *, code='QUOTE_ERROR', status=400, errors=None, data=None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.errors = errors or {}
        self.data = data


def _as_decimal(value, *, field: str) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise QuoteServiceError(
            f'invalid decimal for {field}',
            code='VALIDATION_ERROR',
            status=400,
            errors={field: ['invalid']},
        ) from exc


def build_input_snapshot(revision: DesignRevision, quantity: int) -> dict:
    content = revision.content_json or {}
    geom = content.get('geometry') or {}
    params = geom.get('params') or {}
    outbox = content.get('outbox') or {}
    return {
        'design_revision_id': str(revision.id),
        'revision_no': revision.revision_no,
        'template_id': geom.get('templateId'),
        'template_version': geom.get('templateVersion') or revision.template_version,
        'geometry_hash': geom.get('geometryHash') or revision.geometry_hash,
        'material_id': params.get('materialId'),
        'length_mm': params.get('lengthMm'),
        'width_mm': params.get('widthMm'),
        'height_mm': params.get('heightMm'),
        'thickness_mm': params.get('thicknessMm'),
        'quantity': quantity,
        'outbox_quantity': outbox.get('quantity'),
    }


def input_hash_for(snapshot: dict) -> str:
    return content_hash(snapshot)


def find_official_rule(*, organization_id) -> PricingRuleVersion | None:
    now = timezone.now()
    qs = PricingRuleVersion.objects.filter(is_official=True, is_active=True)
    qs = qs.filter(models.Q(valid_from__isnull=True) | models.Q(valid_from__lte=now))
    qs = qs.filter(models.Q(valid_to__isnull=True) | models.Q(valid_to__gte=now))
    org_rule = qs.filter(organization_id=organization_id).order_by('-created_at').first()
    if org_rule:
        return org_rule
    return qs.filter(organization__isnull=True).order_by('-created_at').first()


def _unit_price_from_rules(rules: dict, quantity: int) -> Decimal:
    tiers = rules.get('quantity_tiers')
    if isinstance(tiers, list) and tiers:
        chosen = None
        for tier in tiers:
            if not isinstance(tier, (list, tuple)) or len(tier) < 2:
                continue
            min_qty = int(tier[0])
            if quantity >= min_qty:
                chosen = tier[1]
        if chosen is not None:
            return _as_decimal(chosen, field='unit_price')
    if 'unit_price' in rules:
        return _as_decimal(rules.get('unit_price'), field='unit_price')
    return Decimal('0')


def compute_quote_amount(rules: dict, quantity: int) -> tuple[Decimal, dict]:
    setup_fee = _as_decimal(rules.get('setup_fee', 0), field='setup_fee')
    unit_price = _unit_price_from_rules(rules, quantity)
    line_total = (unit_price * Decimal(quantity)).quantize(Decimal('0.01'))
    total = (setup_fee + line_total).quantize(Decimal('0.01'))
    breakdown = {
        'setup_fee': str(setup_fee),
        'unit_price': str(unit_price),
        'quantity': quantity,
        'line_total': str(line_total),
        'total': str(total),
    }
    return total, breakdown


def create_quote(*, organization, user, design_revision_id, quantity: int) -> Quote:
    if quantity is None or int(quantity) < 1:
        raise QuoteServiceError(
            'quantity must be >= 1',
            code='VALIDATION_ERROR',
            status=400,
            errors={'quantity': ['min_1']},
        )
    quantity = int(quantity)

    try:
        revision = DesignRevision.objects.select_related('design', 'design__product', 'design__organization').get(
            id=design_revision_id
        )
    except (DesignRevision.DoesNotExist, ValueError, TypeError) as exc:
        raise QuoteServiceError(
            'design revision not found',
            code='REVISION_NOT_FOUND',
            status=404,
            errors={'design_revision_id': ['not_found']},
        ) from exc

    design = revision.design
    if design.organization_id != organization.id:
        raise QuoteServiceError('无权访问设计', code='FORBIDDEN', status=403)

    snapshot = build_input_snapshot(revision, quantity)
    ihash = input_hash_for(snapshot)
    rule = find_official_rule(organization_id=organization.id)

    if rule is None:
        return Quote.objects.create(
            organization=organization,
            created_by=user,
            design=design,
            design_revision=revision,
            product=design.product,
            quantity=quantity,
            status=Quote.Status.PENDING_MANUAL,
            rule_version=None,
            currency='KRW',
            total_amount=None,
            breakdown_json={'reason': 'NO_OFFICIAL_RULE'},
            input_snapshot=snapshot,
            input_hash=ihash,
            valid_until=None,
        )

    total, breakdown = compute_quote_amount(rule.rules_json or {}, quantity)
    return Quote.objects.create(
        organization=organization,
        created_by=user,
        design=design,
        design_revision=revision,
        product=design.product,
        quantity=quantity,
        status=Quote.Status.VALID,
        rule_version=rule,
        currency=rule.currency or 'KRW',
        total_amount=total,
        breakdown_json=breakdown,
        input_snapshot=snapshot,
        input_hash=ihash,
        valid_until=timezone.now() + timedelta(days=7),
    )


def serialize_quote(quote: Quote) -> dict:
    return {
        'id': str(quote.id),
        'organization_id': str(quote.organization_id),
        'design_id': str(quote.design_id),
        'design_revision_id': str(quote.design_revision_id),
        'product_id': str(quote.product_id) if quote.product_id else None,
        'quantity': quote.quantity,
        'status': quote.status,
        'rule_version_id': str(quote.rule_version_id) if quote.rule_version_id else None,
        'currency': quote.currency,
        'total_amount': str(quote.total_amount) if quote.total_amount is not None else None,
        'breakdown': quote.breakdown_json or {},
        'input_snapshot': quote.input_snapshot or {},
        'input_hash': quote.input_hash,
        'valid_until': quote.valid_until.isoformat() if quote.valid_until else None,
        'created_at': quote.created_at.isoformat() if quote.created_at else None,
        'payment_mode': 'manual_quote',
    }
