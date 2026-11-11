from django.test import Client, TestCase

from apps.accounts.models import User
from apps.organizations.services import ensure_personal_org


class AuthOrgTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def test_login_requires_csrf(self):
        User.objects.create_user(email='a@example.com', password='Password123!')
        r = self.client.post(
            '/api/v1/auth/login/',
            data='{"email":"a@example.com","password":"Password123!"}',
            content_type='application/json',
        )
        self.assertEqual(r.status_code, 403)

    def test_register_login_me_logout(self):
        token = self._csrf()
        r = self.client.post(
            '/api/v1/auth/register/',
            data='{"email":"u1@example.com","password":"Password123!","display_name":"U1"}',
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        me = self.client.get('/api/v1/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['data']['user']['email'], 'u1@example.com')
        self.assertGreaterEqual(len(me.json()['data']['organizations']), 1)
        token = self._csrf()
        out = self.client.post(
            '/api/v1/auth/logout/',
            data='{}',
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(out.status_code, 200)
        me2 = self.client.get('/api/v1/me/')
        self.assertEqual(me2.status_code, 401)

    def test_cross_org_forbidden(self):
        u1 = User.objects.create_user(email='o1@example.com', password='Password123!')
        u2 = User.objects.create_user(email='o2@example.com', password='Password123!')
        org1 = ensure_personal_org(u1)
        ensure_personal_org(u2)
        self.client.force_login(u2)
        r = self.client.get(f'/api/v1/organizations/{org1.id}/')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json()['code'], 'FORBIDDEN')

    def test_api_unknown_json_404(self):
        r = self.client.get('/api/v1/does-not-exist/')
        self.assertIn(r.status_code, (404,))
        self.assertEqual(r['Content-Type'].split(';')[0], 'application/json')
        body = r.json()
        self.assertEqual(body['code'], 'NOT_FOUND')
