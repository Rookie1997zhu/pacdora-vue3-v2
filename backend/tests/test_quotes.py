import json
import uuid
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.test import Client, TestCase

from apps.accounts.models import User
from apps.designs.models import DesignRevision
from apps.organizations.services import ensure_personal_org
from apps.quotes.models import PricingRuleVersion, Quote
from apps.quotes.services import compute_quote_amount


class QuotesTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')
        call_command('seed_pricing')

        self.u1 = User.objects.create_user(email='q1@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='q2@example.com', password='Password123!')
        self.org1 = ensure_personal_org(self.u1)
        self.org2 = ensure_personal_org(self.u2)

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def _login(self, user):
        self.client.force_login(user)
        return self._csrf()

    def _create_design(self, user, product_slug='import-102040'):
        token = self._login(user)
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'Quote Design', 'product_slug': product_slug}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        return create.json()['data']

    def test_pending_manual_without_official_rule(self):
        design = self._create_design(self.u1)
        revision_id = design['current_revision_id']
        self.assertTrue(revision_id)
        self.assertFalse(
            PricingRuleVersion.objects.filter(is_official=True, is_active=True).exists()
        )

        token = self._csrf()
        r = self.client.post(
            '/api/v1/quotes/',
            data=json.dumps(
                {
                    'design_revision_id': revision_id,
                    'quantity': 100,
                    'total_amount': '999999',
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()['data']
        self.assertEqual(data['status'], 'pending_manual')
        self.assertIsNone(data['total_amount'])
        self.assertEqual(data['breakdown'].get('reason'), 'NO_OFFICIAL_RULE')
        self.assertEqual(data['quantity'], 100)
        self.assertEqual(data['payment_mode'], 'manual_quote')
        self.assertEqual(data['input_snapshot'].get('design_revision_id'), revision_id)

    def test_valid_quote_with_official_rule_ignores_client_total(self):
        PricingRuleVersion.objects.create(
            organization=None,
            version='official-test-1',
            currency='KRW',
            rules_json={
                'setup_fee': '50000',
                'unit_price': '1200',
                'quantity_tiers': [[1, '1200'], [100, '1000']],
            },
            is_official=True,
            is_active=True,
        )
        expected_total, expected_breakdown = compute_quote_amount(
            {
                'setup_fee': '50000',
                'unit_price': '1200',
                'quantity_tiers': [[1, '1200'], [100, '1000']],
            },
            100,
        )
        self.assertEqual(expected_total, Decimal('150000.00'))

        design = self._create_design(self.u1)
        token = self._csrf()
        r = self.client.post(
            '/api/v1/quotes/',
            data=json.dumps(
                {
                    'design_revision_id': design['current_revision_id'],
                    'quantity': 100,
                    'total_amount': '1',
                    'unit_price': '1',
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()['data']
        self.assertEqual(data['status'], 'valid')
        self.assertEqual(data['total_amount'], str(expected_total))
        self.assertEqual(data['currency'], 'KRW')
        self.assertEqual(data['breakdown']['unit_price'], expected_breakdown['unit_price'])
        self.assertIsNotNone(data['valid_until'])
        self.assertNotEqual(data['total_amount'], '1')

    def test_cross_org_quote_forbidden(self):
        design = self._create_design(self.u1)
        token = self._csrf()
        created = self.client.post(
            '/api/v1/quotes/',
            data=json.dumps(
                {'design_revision_id': design['current_revision_id'], 'quantity': 10}
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(created.status_code, 201, created.content)
        quote_id = created.json()['data']['id']

        self.client.logout()
        self._login(self.u2)
        bad = self.client.get(f'/api/v1/quotes/{quote_id}/')
        self.assertEqual(bad.status_code, 403)
        self.assertEqual(bad.json()['code'], 'FORBIDDEN')

    @patch('apps.designs.services.validate_geometry')
    def test_quote_snapshot_stable_after_design_edit(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'g-quote', 'ok': True}
        design = self._create_design(self.u1, product_slug='mailer-parametric-demo')
        rev_id = design['current_revision_id']
        token = self._csrf()
        quoted = self.client.post(
            '/api/v1/quotes/',
            data=json.dumps({'design_revision_id': rev_id, 'quantity': 12}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(quoted.status_code, 201, quoted.content)
        quote_data = quoted.json()['data']
        snap_before = quote_data['input_snapshot']
        hash_before = quote_data['input_hash']

        content = design['content']
        content['geometry']['params']['lengthMm'] = 318
        token = self._csrf()
        saved = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(saved.status_code, 201, saved.content)
        self.assertNotEqual(saved.json()['data']['content']['geometry']['params']['lengthMm'], snap_before.get('length_mm'))

        detail = self.client.get(f'/api/v1/quotes/{quote_data["id"]}/')
        self.assertEqual(detail.status_code, 200)
        again = detail.json()['data']
        self.assertEqual(again['design_revision_id'], rev_id)
        self.assertEqual(again['input_hash'], hash_before)
        self.assertEqual(again['input_snapshot'], snap_before)
        self.assertEqual(
            DesignRevision.objects.get(id=rev_id).content_json['geometry']['params']['lengthMm'],
            snap_before.get('length_mm'),
        )
        self.assertEqual(Quote.objects.filter(id=quote_data['id']).count(), 1)
