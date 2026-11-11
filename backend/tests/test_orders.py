import json
import uuid
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.test import Client, TestCase

from apps.accounts.models import User
from apps.orders.models import Cart, Order
from apps.organizations.services import ensure_personal_org
from apps.quotes.models import PricingRuleVersion
from apps.quotes.services import compute_quote_amount


class OrdersTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')
        call_command('seed_pricing')

        self.u1 = User.objects.create_user(email='o1@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='o2@example.com', password='Password123!')
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
            data=json.dumps({'name': 'Order Design', 'product_slug': product_slug}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        return create.json()['data']

    def _add_to_cart(self, revision_id, quantity=10, quote_id=None, total_amount=None):
        token = self._csrf()
        body = {'design_revision_id': revision_id, 'quantity': quantity}
        if quote_id:
            body['quote_id'] = quote_id
        if total_amount is not None:
            body['total_amount'] = total_amount
        r = self.client.post(
            '/api/v1/cart/items/',
            data=json.dumps(body),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()['data']

    def _checkout(self, idem_key, extra_body=None):
        token = self._csrf()
        body = extra_body or {}
        return self.client.post(
            '/api/v1/orders/',
            data=json.dumps(body),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=idem_key,
        )

    def test_pending_manual_checkout_without_official_rule(self):
        self.assertFalse(
            PricingRuleVersion.objects.filter(is_official=True, is_active=True).exists()
        )
        design = self._create_design(self.u1)
        added = self._add_to_cart(design['current_revision_id'], quantity=50, total_amount='999999')
        quote = added['item']['quote']
        self.assertIsNotNone(quote)
        self.assertEqual(quote['status'], 'pending_manual')
        self.assertIsNone(quote['total_amount'])

        idem = str(uuid.uuid4())
        r = self._checkout(idem, extra_body={'total_amount': '1'})
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()['data']
        self.assertEqual(data['status'], 'pending_manual')
        self.assertIsNone(data['total_amount'])
        self.assertEqual(data['payment_mode'], 'manual_quote')
        self.assertEqual(data['items'][0]['line_status'], 'pending_manual')
        self.assertIsNone(data['items'][0]['line_amount'])
        self.assertEqual(Cart.objects.filter(organization=self.org1, status=Cart.Status.CHECKED_OUT).count(), 1)
        self.assertEqual(Cart.objects.filter(organization=self.org1, status=Cart.Status.ACTIVE).count(), 1)

    def test_quoted_checkout_with_official_rule_ignores_client_total(self):
        PricingRuleVersion.objects.create(
            organization=None,
            version='official-order-1',
            currency='KRW',
            rules_json={
                'setup_fee': '50000',
                'unit_price': '1200',
                'quantity_tiers': [[1, '1200'], [100, '1000']],
            },
            is_official=True,
            is_active=True,
        )
        expected_total, _ = compute_quote_amount(
            {
                'setup_fee': '50000',
                'unit_price': '1200',
                'quantity_tiers': [[1, '1200'], [100, '1000']],
            },
            100,
        )
        self.assertEqual(expected_total, Decimal('150000.00'))

        design = self._create_design(self.u1)
        added = self._add_to_cart(
            design['current_revision_id'],
            quantity=100,
            total_amount='1',
        )
        self.assertEqual(added['item']['quote']['status'], 'valid')
        self.assertEqual(added['item']['quote']['total_amount'], str(expected_total))

        idem = str(uuid.uuid4())
        r = self._checkout(idem, extra_body={'total_amount': '9'})
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()['data']
        self.assertEqual(data['status'], 'quoted')
        self.assertEqual(data['total_amount'], str(expected_total))
        self.assertNotEqual(data['total_amount'], '9')
        self.assertEqual(data['items'][0]['line_status'], 'priced')
        self.assertEqual(data['items'][0]['line_amount'], str(expected_total))
        self.assertEqual(data['payment_mode'], 'manual_quote')

    def test_cross_org_order_forbidden(self):
        design = self._create_design(self.u1)
        self._add_to_cart(design['current_revision_id'], quantity=5)
        idem = str(uuid.uuid4())
        created = self._checkout(idem)
        self.assertEqual(created.status_code, 201, created.content)
        order_id = created.json()['data']['id']

        self.client.logout()
        self._login(self.u2)
        bad = self.client.get(f'/api/v1/orders/{order_id}/')
        self.assertEqual(bad.status_code, 403)
        self.assertEqual(bad.json()['code'], 'FORBIDDEN')

        cart_cross = self.client.post(
            '/api/v1/cart/items/',
            data=json.dumps(
                {
                    'design_revision_id': design['current_revision_id'],
                    'quantity': 1,
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self._csrf(),
        )
        self.assertEqual(cart_cross.status_code, 403)
        self.assertEqual(cart_cross.json()['code'], 'FORBIDDEN')

    def test_idempotency_key_replays_same_order(self):
        design = self._create_design(self.u1)
        self._add_to_cart(design['current_revision_id'], quantity=3)
        idem = str(uuid.uuid4())
        first = self._checkout(idem)
        self.assertEqual(first.status_code, 201, first.content)
        order_id = first.json()['data']['id']
        order_no = first.json()['data']['order_no']

        # After checkout cart is empty; replay must still return same order.
        second = self._checkout(idem, extra_body={'total_amount': '999'})
        self.assertEqual(second.status_code, 200, second.content)
        self.assertEqual(second.json()['message'], '幂等重放')
        self.assertEqual(second.json()['data']['id'], order_id)
        self.assertEqual(second.json()['data']['order_no'], order_no)
        self.assertEqual(Order.objects.filter(organization=self.org1).count(), 1)

    @patch('apps.designs.services.validate_geometry')
    def test_order_snapshot_stable_after_design_edit(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'g-order', 'ok': True}
        design = self._create_design(self.u1, product_slug='mailer-parametric-demo')
        rev_id = design['current_revision_id']
        self._add_to_cart(rev_id, quantity=12)
        idem = str(uuid.uuid4())
        ordered = self._checkout(idem)
        self.assertEqual(ordered.status_code, 201, ordered.content)
        data = ordered.json()['data']
        snap_before = data['items_snapshot']
        self.assertTrue(snap_before)
        self.assertEqual(snap_before[0]['design_revision_id'], rev_id)

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
        self.assertEqual(
            saved.json()['data']['content']['geometry']['params']['lengthMm'],
            318,
        )

        new_rev = saved.json()['data']['revision']['id']
        self.assertIsNotNone(new_rev)
        self.assertNotEqual(new_rev, rev_id)

        detail = self.client.get(f'/api/v1/orders/{data["id"]}/')
        self.assertEqual(detail.status_code, 200)
        again = detail.json()['data']
        self.assertEqual(again['items_snapshot'], snap_before)
        self.assertEqual(again['items'][0]['design_revision_id'], rev_id)
        self.assertEqual(Order.objects.filter(id=data['id']).count(), 1)

    def _create_pending_order(self):
        design = self._create_design(self.u1)
        self._add_to_cart(design['current_revision_id'], quantity=8)
        created = self._checkout(str(uuid.uuid4()))
        self.assertEqual(created.status_code, 201, created.content)
        return created.json()['data']

    def _manual_quote(self, order_data, amount='12345.00', row_version=None):
        token = self._csrf()
        lines = [
            {'id': item['id'], 'line_amount': amount}
            for item in order_data['items']
            if item['line_status'] == 'pending_manual'
        ]
        return self.client.post(
            f'/api/v1/orders/{order_data["id"]}/manual-quote/',
            data=json.dumps(
                {
                    'expected_row_version': (
                        order_data['row_version'] if row_version is None else row_version
                    ),
                    'lines': lines,
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )

    def test_manual_quote_then_confirm(self):
        pending = self._create_pending_order()
        self.assertEqual(pending['status'], 'pending_manual')
        self.assertIsNone(pending['total_amount'])

        quoted = self._manual_quote(pending, amount='25000.00')
        self.assertEqual(quoted.status_code, 200, quoted.content)
        data = quoted.json()['data']
        self.assertEqual(data['status'], 'quoted')
        self.assertEqual(data['total_amount'], '25000.00')
        self.assertEqual(data['items'][0]['line_status'], 'priced')
        self.assertEqual(data['items'][0]['line_amount'], '25000.00')
        self.assertEqual(data['row_version'], pending['row_version'] + 1)
        self.assertEqual(data['items_snapshot'][0]['line_status'], 'priced')
        self.assertEqual(data['items_snapshot'][0]['line_amount'], '25000.00')

        confirmed_resp = self.client.post(
            f'/api/v1/orders/{data["id"]}/confirm/',
            data=json.dumps({'expected_row_version': data['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self._csrf(),
        )
        self.assertEqual(confirmed_resp.status_code, 200, confirmed_resp.content)
        confirmed = confirmed_resp.json()['data']
        self.assertEqual(confirmed['status'], 'confirmed')
        self.assertEqual(confirmed['total_amount'], '25000.00')

        again = self.client.post(
            f'/api/v1/orders/{confirmed["id"]}/confirm/',
            data=json.dumps({'expected_row_version': confirmed['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self._csrf(),
        )
        self.assertEqual(again.status_code, 400)
        self.assertEqual(again.json()['code'], 'INVALID_STATUS')

    def test_cancel_pending_and_quoted_and_block_confirmed(self):
        pending = self._create_pending_order()
        cancelled = self.client.post(
            f'/api/v1/orders/{pending["id"]}/cancel/',
            data=json.dumps({'expected_row_version': pending['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self._csrf(),
        )
        self.assertEqual(cancelled.status_code, 200, cancelled.content)
        self.assertEqual(cancelled.json()['data']['status'], 'cancelled')

        pending2 = self._create_pending_order()
        quoted = self._manual_quote(pending2, amount='1000.00')
        self.assertEqual(quoted.status_code, 200, quoted.content)
        qdata = quoted.json()['data']
        cancelled2 = self.client.post(
            f'/api/v1/orders/{qdata["id"]}/cancel/',
            data=json.dumps({'expected_row_version': qdata['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self._csrf(),
        )
        self.assertEqual(cancelled2.status_code, 200, cancelled2.content)
        self.assertEqual(cancelled2.json()['data']['status'], 'cancelled')

        pending3 = self._create_pending_order()
        quoted3 = self._manual_quote(pending3, amount='2000.00')
        q3 = quoted3.json()['data']
        confirmed = self.client.post(
            f'/api/v1/orders/{q3["id"]}/confirm/',
            data=json.dumps({'expected_row_version': q3['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self._csrf(),
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.content)
        cdata = confirmed.json()['data']
        bad = self.client.post(
            f'/api/v1/orders/{cdata["id"]}/cancel/',
            data=json.dumps({'expected_row_version': cdata['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=self._csrf(),
        )
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.json()['code'], 'INVALID_STATUS')

    def test_manual_quote_row_version_conflict(self):
        pending = self._create_pending_order()
        conflict = self._manual_quote(pending, amount='100.00', row_version=pending['row_version'] + 9)
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()['code'], 'ORDER_VERSION_CONFLICT')
        self.assertEqual(conflict.json()['data']['row_version'], pending['row_version'])

    def test_manual_quote_cross_org_forbidden(self):
        pending = self._create_pending_order()
        self.client.logout()
        self._login(self.u2)
        bad = self._manual_quote(pending, amount='100.00')
        self.assertEqual(bad.status_code, 403)
        self.assertEqual(bad.json()['code'], 'FORBIDDEN')
