import json

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from apps.accounts.models import User
from apps.organizations.services import ensure_personal_org
from apps.samples.models import SampleTestRecord
from apps.samples.services import create_sample_test, review_sample


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class SampleTestApiTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')
        self.staff = User.objects.create_user(
            email='sample-staff@example.com',
            password='Password123!',
            is_staff=True,
        )
        self.member = User.objects.create_user(
            email='sample-member@example.com',
            password='Password123!',
        )
        ensure_personal_org(self.staff)
        ensure_personal_org(self.member)

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def _login(self, user):
        self.client.force_login(user)
        return self._csrf()

    def _sample_body(self, **overrides):
        body = {
            'template_key': 'fefco-0201',
            'geometry_hash': 'g1:testhash00000000000000000000000000000000000000000000000000000000',
            'length_mm': 300,
            'width_mm': 200,
            'height_mm': 150,
            'thickness_mm': 3,
            'material_id': 'kraft',
            'flute_direction': 'L',
            'size_mode': 'inner',
            'process_profile': 'sample-cut-crease-v1',
            'equipment': 'lab-plotter',
            'notes': 'software loop fixture',
        }
        body.update(overrides)
        return body

    def test_member_cannot_create_sample(self):
        token = self._login(self.member)
        r = self.client.post(
            '/api/v1/sample-tests/',
            data=json.dumps(self._sample_body()),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertIn(r.status_code, (401, 403))

    def test_staff_creates_pending_and_non_staff_cannot_review(self):
        token = self._login(self.staff)
        r = self.client.post(
            '/api/v1/sample-tests/',
            data=json.dumps(self._sample_body()),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()['data']
        self.assertEqual(data['verdict'], 'pending')
        self.assertEqual(data['template_key'], 'fefco-0201')
        sample_id = data['id']

        token = self._login(self.member)
        r = self.client.post(
            f'/api/v1/sample-tests/{sample_id}/review/',
            data=json.dumps({'verdict': 'pass'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertIn(r.status_code, (401, 403))
        rec = SampleTestRecord.objects.get(pk=sample_id)
        self.assertEqual(rec.verdict, SampleTestRecord.Verdict.PENDING)

    def test_evidence_and_review_pass_freezes_narrow_domain(self):
        token = self._login(self.staff)
        r = self.client.post(
            '/api/v1/sample-tests/',
            data=json.dumps(self._sample_body()),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        sample_id = r.json()['data']['id']

        png = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
            b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f'
            b'\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        upload = SimpleUploadedFile('evidence.png', png, content_type='image/png')
        r = self.client.post(
            f'/api/v1/sample-tests/{sample_id}/evidence/',
            data={'file': upload},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(len(r.json()['data']['evidence_asset_ids']), 1)

        r = self.client.post(
            f'/api/v1/sample-tests/{sample_id}/review/',
            data=json.dumps({'verdict': 'pass', 'notes': 'ok for this size only'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()['data']
        self.assertEqual(data['verdict'], 'pass')
        self.assertEqual(data['length_min_mm'], 300.0)
        self.assertEqual(data['length_max_mm'], 300.0)
        self.assertEqual(data['width_min_mm'], 200.0)
        self.assertEqual(data['height_max_mm'], 150.0)
        self.assertEqual(data['thickness_min_mm'], 3.0)
        self.assertTrue(data['reviewed_at'])

    def test_list_filters_by_template_and_verdict(self):
        org = ensure_personal_org(self.staff)
        rec = create_sample_test(organization=org, user=self.staff, body=self._sample_body())
        review_sample(record=rec, reviewer=self.staff, verdict='pass')
        create_sample_test(
            organization=org,
            user=self.staff,
            body=self._sample_body(geometry_hash='g1:other'),
        )
        token = self._login(self.staff)
        r = self.client.get('/api/v1/sample-tests/?template_key=fefco-0201&verdict=pass')
        self.assertEqual(r.status_code, 200)
        items = r.json()['data']['items']
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['verdict'], 'pass')
