import json
import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from apps.accounts.models import User
from apps.assets.models import AssetDerivative
from apps.assets.preview import THUMB_KIND
from apps.organizations.services import ensure_personal_org

PNG_1X1 = bytes.fromhex(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
    '0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082'
)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class ThumbnailTests(TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        media_override = override_settings(MEDIA_ROOT=Path(self._tmpdir.name))
        media_override.enable()
        self.addCleanup(media_override.disable)

        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')

        self.u1 = User.objects.create_user(email='thumb1@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='thumb2@example.com', password='Password123!')
        ensure_personal_org(self.u1)
        ensure_personal_org(self.u2)

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def _login(self, user):
        self.client.force_login(user)
        return self._csrf()

    def _upload_png(self, user, name='a.png'):
        token = self._login(user)
        uploaded = SimpleUploadedFile(name, PNG_1X1, content_type='image/png')
        r = self.client.post(
            '/api/v1/assets/',
            {'file': uploaded},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()['data']

    def test_upload_creates_thumb_256_derivative(self):
        data = self._upload_png(self.u1)
        self.assertTrue(data.get('thumbnail_ready'))
        deriv = AssetDerivative.objects.filter(asset_id=data['id'], kind=THUMB_KIND).first()
        self.assertIsNotNone(deriv)
        self.assertEqual(deriv.mime, 'image/webp')
        path = Path(self._tmpdir.name) / deriv.storage_key
        self.assertTrue(path.exists())
        self.assertGreater(path.stat().st_size, 0)

    def test_thumbnail_auth_and_acl(self):
        data = self._upload_png(self.u1)
        asset_id = data['id']
        ok = self.client.get(f'/api/v1/assets/{asset_id}/thumbnail/')
        self.assertEqual(ok.status_code, 200)
        self.assertIn('image/webp', ok['Content-Type'])
        body = b''.join(ok.streaming_content)
        ok.close()
        self.assertGreater(len(body), 0)

        self.client.logout()
        self._login(self.u2)
        forbidden = self.client.get(f'/api/v1/assets/{asset_id}/thumbnail/')
        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(forbidden.json()['code'], 'FORBIDDEN')

    def test_thumbnail_not_ready_404(self):
        data = self._upload_png(self.u1)
        AssetDerivative.objects.filter(asset_id=data['id'], kind=THUMB_KIND).delete()
        r = self.client.get(f'/api/v1/assets/{data["id"]}/thumbnail/')
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json()['code'], 'THUMBNAIL_NOT_READY')

    @patch('apps.designs.services.validate_geometry')
    def test_design_list_preview_fields(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'geom-thumb', 'ok': True}
        asset = self._upload_png(self.u1)
        token = self._csrf()
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'ThumbPreview', 'product_slug': 'mailer-parametric-demo'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        design = create.json()['data']
        content = design['content']
        content['artwork']['layers'] = [
            {
                'id': 'layer-1',
                'kind': 'image',
                'name': 'art',
                'coordinateSpace': 'panel_mm',
                'panelId': 'front',
                'pieceId': None,
                'side': 'outside',
                'transform': {'xMm': 10, 'yMm': 10, 'rotationDeg': 0, 'scaleX': 1, 'scaleY': 1},
                'widthMm': 40,
                'heightMm': 40,
                'visible': True,
                'locked': False,
                'opacity': 1,
                'zIndex': 1,
                'clip': 'panel',
                'assetId': asset['id'],
                'text': None,
                'shape': None,
                'crop': None,
                'resizePolicy': 'keep_mm',
                'anchor': None,
            }
        ]
        token = self._csrf()
        save = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(save.status_code, 201, save.content)

        listing = self.client.get('/api/v1/designs/')
        self.assertEqual(listing.status_code, 200)
        items = listing.json()['data']['items']
        row = next(i for i in items if i['id'] == design['id'])
        self.assertEqual(row['preview_asset_id'], asset['id'])
        self.assertTrue(row['thumbnail_ready'])
