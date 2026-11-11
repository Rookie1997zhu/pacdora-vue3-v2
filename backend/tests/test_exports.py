import base64
import json
import uuid
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from apps.accounts.models import User
from apps.assets.models import Asset
from apps.assets.services import AssetUploadError, store_bytes, store_upload
from apps.catalog.models import TemplateApproval, TemplateVersion
from apps.exports.models import ExportJob
from apps.organizations.services import ensure_personal_org


def _fake_export(format_name: str, *, cut_approx=False, bleed_approx=False, quality_tier=None):
    if format_name == 'svg':
        raw = b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'
        mime = 'image/svg+xml'
        filename = 'demo.svg'
    elif format_name == 'dxf':
        raw = b'0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n'
        mime = 'application/dxf'
        filename = 'demo.dxf'
    else:
        raw = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'
        mime = 'application/pdf'
        filename = 'demo.pdf'
    disclaimer = (
        'TEMPLATE_APPROVED · NOT A LICENSED PRODUCTION DIE'
        if quality_tier == 'manufacturing'
        else 'DEMO · NOT FOR DIE CUTTING'
    )
    return {
        'mime': mime,
        'filename': filename,
        'content_base64': base64.b64encode(raw).decode('ascii'),
        'preflight': {
            'manufacturing_ready': False,
            'disclaimer': disclaimer,
            'physical_mm': format_name == 'dxf',
            'format': format_name,
            'cut_approx': cut_approx,
            'bleed_approx': bleed_approx,
            'cut_approx_reason': 'test' if cut_approx else None,
            'exporter_version': 'boxcraft.export.v1',
        },
    }


def _fake_validate(*, cut_approx=False, bleed_approx=False):
    return {
        'ok': True,
        'production_ready': True,
        'manufacturing_ready': False,
        'cut_approx': cut_approx,
        'bleed_approx': bleed_approx,
        'cut_approx_reason': 'test' if cut_approx else None,
        'geometry_hash': 'mailer-parametric-demo:300x200x50:T1.5:inner',
    }


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class ExportJobsTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')
        self.u1 = User.objects.create_user(email='ex1@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='ex2@example.com', password='Password123!')
        ensure_personal_org(self.u1)
        ensure_personal_org(self.u2)

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def _login(self, user):
        self.client.force_login(user)
        return self._csrf()

    def _create_design(self, user, slug='mailer-parametric-demo'):
        token = self._login(user)
        r = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'Export Design', 'product_slug': slug}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()['data']

    def test_unauthenticated_rejected(self):
        r = self.client.post(
            f'/api/v1/designs/{uuid.uuid4()}/exports/',
            data=json.dumps({'format': 'pdf', 'quality_tier': 'vector_proof'}),
            content_type='application/json',
        )
        self.assertIn(r.status_code, (401, 403))

    def test_manufacturing_blocked_without_capability(self):
        design = self._create_design(self.u1, slug='fefco-0201')
        token = self._csrf()
        before = Asset.objects.count()
        before_jobs = ExportJob.objects.count()
        with patch('apps.exports.services.validate_geometry', return_value=_fake_validate()):
            r = self.client.post(
                f'/api/v1/designs/{design["id"]}/exports/',
                data=json.dumps({'format': 'pdf', 'quality_tier': 'manufacturing'}),
                content_type='application/json',
                HTTP_X_CSRFTOKEN=token,
                HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
            )
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()['code'], 'MANUFACTURING_BLOCKED')
        failed = r.json().get('errors', {}).get('failed_checks') or []
        self.assertIn('CAPABILITY', failed)
        self.assertEqual(Asset.objects.count(), before)
        self.assertEqual(ExportJob.objects.count(), before_jobs)

    @patch('apps.exports.services.export_dieline')
    @patch('apps.exports.services.validate_geometry')
    def test_manufacturing_blocked_when_approx(self, mock_validate, mock_export):
        mock_validate.return_value = _fake_validate(cut_approx=True)
        design = self._create_design(self.u1)
        token = self._csrf()
        before_jobs = ExportJob.objects.count()
        r = self.client.post(
            f'/api/v1/designs/{design["id"]}/exports/',
            data=json.dumps({'format': 'pdf', 'quality_tier': 'manufacturing'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()['code'], 'MANUFACTURING_BLOCKED')
        failed = r.json().get('errors', {}).get('failed_checks') or []
        self.assertIn('APPROX', failed)
        self.assertEqual(ExportJob.objects.count(), before_jobs)
        mock_export.assert_not_called()

    @patch('apps.exports.services.export_dieline')
    @patch('apps.exports.services.validate_geometry')
    def test_manufacturing_succeeds_when_gate_passes(self, mock_validate, mock_export):
        mock_validate.return_value = _fake_validate()
        mock_export.side_effect = lambda payload: _fake_export(
            payload.get('format') or 'pdf',
            quality_tier=payload.get('quality_tier'),
        )
        design = self._create_design(self.u1)
        self.assertTrue(design.get('capabilities', {}).get('canExportManufacturing'))
        from apps.designs.models import Design

        d = Design.objects.get(pk=design['id'])
        revision = d.current_revision
        token = self._csrf()
        r = self.client.post(
            f'/api/v1/designs/{design["id"]}/exports/',
            data=json.dumps(
                {
                    'format': 'pdf',
                    'quality_tier': 'manufacturing',
                    'revision_id': str(revision.id),
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(r.status_code, 202, r.content)
        job = r.json()['data']
        self.assertEqual(job['status'], 'succeeded')
        self.assertEqual(job['quality_tier'], 'manufacturing')
        self.assertEqual(job['content_hash'], revision.content_hash)
        self.assertEqual(job['geometry_hash'], revision.geometry_hash)
        self.assertTrue(job['preflight'].get('manufacturing_ready'))
        self.assertEqual(job['preflight'].get('license', {}).get('code'), 'B-GEOM-LICENSE')
        self.assertEqual(job['preflight'].get('license', {}).get('status'), 'open')
        self.assertTrue(job['preflight'].get('approval_id'))
        dl = self.client.get(f'/api/v1/exports/{job["id"]}/download/')
        self.assertEqual(dl.status_code, 200)
        body = b''.join(dl.streaming_content)
        self.assertTrue(body.startswith(b'%PDF'))

    @patch('apps.exports.services.export_dieline')
    @patch('apps.exports.services.validate_geometry')
    def test_manufacturing_blocked_without_approval(self, mock_validate, mock_export):
        mock_validate.return_value = _fake_validate()
        TemplateApproval.objects.filter(
            template_version__template__template_key='mailer-parametric-demo'
        ).delete()
        design = self._create_design(self.u1)
        token = self._csrf()
        before_jobs = ExportJob.objects.count()
        r = self.client.post(
            f'/api/v1/designs/{design["id"]}/exports/',
            data=json.dumps({'format': 'svg', 'quality_tier': 'manufacturing'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()['code'], 'MANUFACTURING_BLOCKED')
        failed = r.json().get('errors', {}).get('failed_checks') or []
        self.assertIn('APPROVAL', failed)
        self.assertEqual(ExportJob.objects.count(), before_jobs)
        mock_export.assert_not_called()

    @patch('apps.exports.services.export_dieline')
    def test_vector_proof_formats_and_download(self, mock_export):
        from apps.designs.models import Design

        design = self._create_design(self.u1)
        d = Design.objects.get(pk=design['id'])
        revision = d.current_revision
        self.assertIsNotNone(revision)

        for fmt in ('svg', 'dxf', 'pdf'):
            mock_export.side_effect = lambda payload, f=fmt: _fake_export(payload.get('format') or f)
            token = self._csrf()
            key = f'export-{fmt}-{uuid.uuid4()}'
            r = self.client.post(
                f'/api/v1/designs/{design["id"]}/exports/',
                data=json.dumps(
                    {
                        'format': fmt,
                        'quality_tier': 'vector_proof',
                        'revision_id': str(revision.id),
                    }
                ),
                content_type='application/json',
                HTTP_X_CSRFTOKEN=token,
                HTTP_IDEMPOTENCY_KEY=key,
            )
            self.assertEqual(r.status_code, 202, r.content)
            job = r.json()['data']
            self.assertEqual(job['status'], 'succeeded')
            self.assertEqual(job['format'], fmt)
            self.assertEqual(job['content_hash'], revision.content_hash)
            self.assertEqual(job['geometry_hash'], revision.geometry_hash)
            self.assertTrue(job['result_asset_id'])
            self.assertTrue(job['checksum'])
            self.assertFalse(job['preflight'].get('manufacturing_ready'))

            dl = self.client.get(f'/api/v1/exports/{job["id"]}/download/')
            self.assertEqual(dl.status_code, 200)
            body = b''.join(dl.streaming_content)
            if fmt == 'svg':
                self.assertTrue(body.lstrip().startswith(b'<?xml') or b'<svg' in body)
            elif fmt == 'dxf':
                self.assertIn(b'SECTION', body)
            else:
                self.assertTrue(body.startswith(b'%PDF'))

            # idempotent replay
            token = self._csrf()
            replay = self.client.post(
                f'/api/v1/designs/{design["id"]}/exports/',
                data=json.dumps(
                    {
                        'format': fmt,
                        'quality_tier': 'vector_proof',
                        'revision_id': str(revision.id),
                    }
                ),
                content_type='application/json',
                HTTP_X_CSRFTOKEN=token,
                HTTP_IDEMPOTENCY_KEY=key,
            )
            self.assertEqual(replay.status_code, 200)
            self.assertEqual(replay.json()['data']['id'], job['id'])

    @patch('apps.exports.services.export_dieline')
    def test_idempotency_conflict(self, mock_export):
        mock_export.side_effect = lambda payload: _fake_export(payload.get('format') or 'svg')
        design = self._create_design(self.u1)
        token = self._csrf()
        key = 'export-conflict-1'
        ok = self.client.post(
            f'/api/v1/designs/{design["id"]}/exports/',
            data=json.dumps({'format': 'svg', 'quality_tier': 'vector_proof'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=key,
        )
        self.assertEqual(ok.status_code, 202, ok.content)
        token = self._csrf()
        bad = self.client.post(
            f'/api/v1/designs/{design["id"]}/exports/',
            data=json.dumps({'format': 'pdf', 'quality_tier': 'vector_proof'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=key,
        )
        self.assertEqual(bad.status_code, 409)
        self.assertEqual(bad.json()['code'], 'IDEMPOTENCY_CONFLICT')

    @patch('apps.exports.services.export_dieline')
    def test_cross_org_forbidden(self, mock_export):
        mock_export.side_effect = lambda payload: _fake_export('svg')
        design = self._create_design(self.u1)
        token = self._csrf()
        r = self.client.post(
            f'/api/v1/designs/{design["id"]}/exports/',
            data=json.dumps({'format': 'svg', 'quality_tier': 'vector_proof'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        job_id = r.json()['data']['id']
        self.client.logout()
        self._login(self.u2)
        g = self.client.get(f'/api/v1/exports/{job_id}/')
        self.assertEqual(g.status_code, 403)
        d = self.client.get(f'/api/v1/exports/{job_id}/download/')
        self.assertEqual(d.status_code, 403)

    def test_user_upload_still_rejects_export_mime(self):
        self._login(self.u1)
        org = ensure_personal_org(self.u1)
        uploaded = SimpleUploadedFile('x.svg', b'<svg/>', content_type='image/svg+xml')
        with self.assertRaises(AssetUploadError):
            store_upload(organization=org, owner=self.u1, uploaded_file=uploaded)
        asset = store_bytes(
            organization=org,
            owner=self.u1,
            data=b'<svg/>',
            mime='image/svg+xml',
            filename='ok.svg',
            source='export',
        )
        self.assertEqual(asset.source, 'export')
        self.assertTrue(asset.sha256)

    def test_seed_mailer_has_manufacturing_capability(self):
        ver = TemplateVersion.objects.get(template__template_key='mailer-parametric-demo', version='1')
        self.assertTrue((ver.capabilities or {}).get('canExportManufacturing'))
        self.assertTrue(TemplateApproval.objects.filter(template_version=ver, approved=True).exists())
