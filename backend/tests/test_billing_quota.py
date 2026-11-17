import json
from datetime import timedelta

from django.test import Client, TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.billing.errors import BillingError
from apps.billing.models import ExportGrant, OrganizationEntitlement, UpgradeIntent
from apps.billing.services import consume_export, get_or_create_entitlement, remaining_exports
from apps.organizations.services import ensure_personal_org


class BillingQuotaTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(email='bill@example.com', password='Password123!')
        self.org = ensure_personal_org(self.user)
        self.ent = get_or_create_entitlement(self.org)

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def test_default_remaining_is_10(self):
        self.assertEqual(self.ent.free_export_limit, 10)
        self.assertEqual(remaining_exports(self.ent), 10)

    def test_consume_until_exceeded(self):
        for _ in range(10):
            consume_export(organization=self.org, actor=self.user, reason=ExportGrant.Reason.LAB_CLIENT)
        self.ent.refresh_from_db()
        self.assertEqual(self.ent.exports_used, 10)
        with self.assertRaises(BillingError) as ctx:
            consume_export(organization=self.org, actor=self.user, reason=ExportGrant.Reason.LAB_CLIENT)
        self.assertEqual(ctx.exception.code, 'EXPORT_QUOTA_EXCEEDED')
        self.assertEqual(ctx.exception.status, 403)

    def test_annual_unlimited_does_not_increment_used(self):
        self.ent.plan = OrganizationEntitlement.Plan.ANNUAL
        self.ent.annual_expires_at = timezone.now() + timedelta(days=30)
        self.ent.exports_used = 10
        self.ent.save()
        result = consume_export(organization=self.org, actor=self.user, reason=ExportGrant.Reason.LAB_CLIENT)
        self.ent.refresh_from_db()
        self.assertFalse(result['consumed_quota'])
        self.assertEqual(self.ent.exports_used, 10)
        self.assertTrue(result['entitlement']['unlimited'])

    def test_lab_grant_api_and_me_entitlement(self):
        self.client.force_login(self.user)
        me = self.client.get('/api/v1/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['data']['entitlement']['remaining'], 10)

        token = self._csrf()
        r = self.client.post(
            '/api/v1/billing/export-grants/',
            data=json.dumps({'format': 'svg'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        body = r.json()['data']
        self.assertTrue(body['grant_id'])
        self.assertEqual(body['remaining'], 9)

    def test_upgrade_intent_no_payment(self):
        self.client.force_login(self.user)
        token = self._csrf()
        r = self.client.post(
            '/api/v1/billing/upgrade-intents/',
            data=json.dumps({'plan': 'annual', 'note': 'please', 'contact': 'bill@example.com'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(UpgradeIntent.objects.filter(user=self.user).count(), 1)
        self.assertEqual(r.json()['data']['status'], 'submitted')

    def test_console_patch_entitlement(self):
        staff = User.objects.create_user(email='staff@example.com', password='Password123!', is_staff=True)
        self.client.force_login(staff)
        token = self._csrf()
        expires = (timezone.now() + timedelta(days=365)).isoformat()
        r = self.client.patch(
            f'/api/v1/console/orgs/{self.org.id}/entitlement/',
            data=json.dumps(
                {
                    'plan': 'annual',
                    'annual_expires_at': expires,
                    'free_export_limit': 10,
                    'exports_used': 10,
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()['data']
        self.assertEqual(data['plan'], 'annual')
        self.assertTrue(data['unlimited'])
