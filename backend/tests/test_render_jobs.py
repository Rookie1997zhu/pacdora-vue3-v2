import json
import struct
import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from apps.accounts.models import User
from apps.billing.models import OrganizationEntitlement
from apps.billing.services import get_or_create_entitlement
from apps.organizations.services import ensure_personal_org
from apps.render_scenes.document import create_default_scene
from apps.render_scenes.models import RenderJob


PNG_1X1 = bytes.fromhex(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
    '0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082'
)


def _minimal_glb(*, with_external_uri=False) -> bytes:
    gltf = {
        'asset': {'version': '2.0'},
        'scenes': [{'nodes': [0]}],
        'scene': 0,
        'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0}}]}],
        'accessors': [
            {
                'bufferView': 0,
                'componentType': 5126,
                'count': 3,
                'type': 'VEC3',
                'max': [1, 1, 0],
                'min': [0, 0, 0],
            }
        ],
        'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 36}],
        'buffers': [{'byteLength': 36}],
    }
    if with_external_uri:
        gltf['images'] = [{'uri': 'https://evil.example/tex.png'}]
    json_bytes = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    while len(json_bytes) % 4:
        json_bytes += b' '
    bin_bytes = b'\x00' * 36
    while len(bin_bytes) % 4:
        bin_bytes += b'\x00'
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    header = struct.pack('<4sII', b'glTF', 2, total)
    json_chunk = struct.pack('<I4s', len(json_bytes), b'JSON') + json_bytes
    bin_chunk = struct.pack('<I4s', len(bin_bytes), b'BIN\x00') + bin_bytes
    return header + json_chunk + bin_chunk


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class RenderJobsTests(TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        media_override = override_settings(MEDIA_ROOT=Path(self._tmpdir.name))
        media_override.enable()
        self.addCleanup(media_override.disable)

        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')
        self.u1 = User.objects.create_user(email='rj1@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='rj2@example.com', password='Password123!')
        self.org1 = ensure_personal_org(self.u1)
        ensure_personal_org(self.u2)
        ent = get_or_create_entitlement(self.org1)
        ent.free_export_limit = 5
        ent.exports_used = 0
        ent.save(update_fields=['free_export_limit', 'exports_used', 'updated_at'])

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def _login(self, user):
        self.client.force_login(user)
        return self._csrf()

    @patch('apps.designs.services.validate_geometry')
    def _scene(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'geom-rj', 'ok': True}
        token = self._login(self.u1)
        design = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'Box', 'product_slug': 'mailer-parametric-demo'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        ).json()['data']
        content = create_default_scene()
        content['models'] = [
            {
                'id': str(uuid.uuid4()),
                'designId': design['id'],
                'revisionId': design['current_revision_id'],
                'position': {'x': 0, 'y': 0, 'z': 0},
                'rotation': {'x': 0, 'y': 0, 'z': 0},
                'scale': 1,
                'foldProgress': 100,
                'materialId': 'kraft',
            }
        ]
        scene = self.client.post(
            '/api/v1/render-scenes/',
            data=json.dumps({'name': 'S', 'content': content}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(scene.status_code, 201, scene.content)
        return scene.json()['data'], token

    @patch('apps.render_scenes.jobs.call_render', return_value=PNG_1X1)
    def test_render_job_success_and_download(self, _mock_render):
        from apps.assets.models import Asset
        from apps.render_scenes.result_files import resolve_result_path

        scene, token = self._scene()
        glb = _minimal_glb()
        uploaded = SimpleUploadedFile('scene.glb', glb, content_type='model/gltf-binary')
        create = self.client.post(
            f'/api/v1/render-scenes/{scene["id"]}/render-jobs/',
            data={
                'file': uploaded,
                'width': '1024',
                'height': '1024',
                'format': 'png',
                'scene_snapshot': json.dumps(scene['content']),
            },
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY='render-key-1',
        )
        self.assertEqual(create.status_code, 202, create.content)
        job = create.json()['data']
        self.assertEqual(job['status'], 'succeeded')
        self.assertFalse(job.get('result_asset_id'))
        self.assertTrue(job.get('checksum'))
        self.assertIsNotNone(resolve_result_path(job['id'], format='png'))
        self.assertFalse(
            Asset.objects.filter(organization=self.org1, source='render').exists()
        )

        detail = self.client.get(f'/api/v1/render-jobs/{job["id"]}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['data']['status'], 'succeeded')

        download = self.client.get(f'/api/v1/render-jobs/{job["id"]}/download/')
        self.assertEqual(download.status_code, 200)
        body = download.content
        self.assertEqual(body[:8], b'\x89PNG\r\n\x1a\n')
        self.assertIsNone(resolve_result_path(job['id'], format='png'))

        again = self.client.get(f'/api/v1/render-jobs/{job["id"]}/download/')
        self.assertEqual(again.status_code, 404)
        self.assertEqual(again.json()['code'], 'ASSET_MISSING')

        ent = OrganizationEntitlement.objects.get(organization=self.org1)
        self.assertEqual(ent.exports_used, 1)

    def test_invalid_glb_rejected(self):
        scene, token = self._scene()
        uploaded = SimpleUploadedFile('scene.glb', b'not-a-glb', content_type='model/gltf-binary')
        create = self.client.post(
            f'/api/v1/render-scenes/{scene["id"]}/render-jobs/',
            data={'file': uploaded, 'width': '1024', 'height': '1024'},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 400)
        self.assertEqual(create.json()['code'], 'INVALID_GLB')

    def test_external_uri_rejected(self):
        scene, token = self._scene()
        uploaded = SimpleUploadedFile(
            'scene.glb',
            _minimal_glb(with_external_uri=True),
            content_type='model/gltf-binary',
        )
        create = self.client.post(
            f'/api/v1/render-scenes/{scene["id"]}/render-jobs/',
            data={'file': uploaded, 'width': '1024', 'height': '1024'},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 400)
        self.assertEqual(create.json()['code'], 'INVALID_GLB')

    @patch(
        'apps.render_scenes.jobs.call_render',
        side_effect=__import__(
            'apps.render_scenes.client', fromlist=['RenderServiceError']
        ).RenderServiceError('boom', code='RENDER_FAILED'),
    )
    def test_failed_render_refunds_quota(self, _mock_render):
        scene, token = self._scene()
        uploaded = SimpleUploadedFile('scene.glb', _minimal_glb(), content_type='model/gltf-binary')
        create = self.client.post(
            f'/api/v1/render-scenes/{scene["id"]}/render-jobs/',
            data={'file': uploaded, 'width': '1024', 'height': '1024'},
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY='render-fail-1',
        )
        self.assertEqual(create.status_code, 202, create.content)
        job = create.json()['data']
        self.assertEqual(job['status'], 'failed')
        ent = OrganizationEntitlement.objects.get(organization=self.org1)
        self.assertEqual(ent.exports_used, 0)

    def test_quota_exceeded(self):
        scene, token = self._scene()
        ent = OrganizationEntitlement.objects.get(organization=self.org1)
        ent.exports_used = ent.free_export_limit
        ent.save(update_fields=['exports_used', 'updated_at'])
        uploaded = SimpleUploadedFile('scene.glb', _minimal_glb(), content_type='model/gltf-binary')
        create = self.client.post(
            f'/api/v1/render-scenes/{scene["id"]}/render-jobs/',
            data={'file': uploaded, 'width': '1024', 'height': '1024'},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 403)
        self.assertEqual(create.json()['code'], 'EXPORT_QUOTA_EXCEEDED')

    def test_cross_org_job_forbidden(self):
        scene, token = self._scene()
        with patch('apps.render_scenes.jobs.call_render', return_value=PNG_1X1):
            uploaded = SimpleUploadedFile('scene.glb', _minimal_glb(), content_type='model/gltf-binary')
            create = self.client.post(
                f'/api/v1/render-scenes/{scene["id"]}/render-jobs/',
                data={'file': uploaded, 'width': '512', 'height': '512'},
                HTTP_X_CSRFTOKEN=token,
                HTTP_IDEMPOTENCY_KEY='render-cross-1',
            )
            self.assertEqual(create.status_code, 202, create.content)
            job_id = create.json()['data']['id']
        self.client.logout()
        self._login(self.u2)
        r = self.client.get(f'/api/v1/render-jobs/{job_id}/')
        self.assertEqual(r.status_code, 403)
