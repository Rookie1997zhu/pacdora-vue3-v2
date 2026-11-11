from django.core.management.base import BaseCommand
from django.db import transaction

from apps.quotes.models import PricingRuleVersion


class Command(BaseCommand):
    help = 'Seed demo pricing rules (is_official=False; never used for live quotes)'

    @transaction.atomic
    def handle(self, *args, **options):
        ver, created = PricingRuleVersion.objects.update_or_create(
            organization=None,
            version='demo-1',
            defaults={
                'currency': 'KRW',
                'rules_json': {
                    'setup_fee': '50000',
                    'unit_price': '1200',
                    'quantity_tiers': [[1, '1200'], [100, '1000'], [500, '800']],
                    'note': 'DEMO ONLY — not for official quotes',
                },
                'is_official': False,
                'is_active': True,
                'valid_from': None,
                'valid_to': None,
            },
        )
        action = 'created' if created else 'updated'
        self.stdout.write(
            self.style.SUCCESS(
                f'seed_pricing {action} demo rule {ver.id} (is_official=False)'
            )
        )
