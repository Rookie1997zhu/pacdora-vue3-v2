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
from apps.billing.services import get_or_create_entitlement
from apps.designs.models import Design
from apps.organizations.services import ensure_personal_org
from apps.render_scenes.catalog import seed_render_catalog
from apps.render_scenes.document import SCHEMA_VERSION, create_default_scene, upgrade_scene_to_v2, validate_render_scene
from apps.render_scenes.models import RenderBatch, RenderEnvironment, RenderJob, RenderProp


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
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    header = struct.pack('<4sII', b'glTF', 2, total)
    json_chunk = struct.pack('<I4s', len(json_bytes), b'JSON') + json_bytes
    bin_chunk = struct.pack('<I4s', len(bin_bytes), b'BIN\x00') + bin_bytes
    return header + json_chunk + bin_chunk


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class RenderV2Tests(TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        media_override = override_settings(MEDIA_ROOT=Path(self._tmpdir.name))
        media_override.enable()
        self.addCleanup(media_override.disable)

        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')
        self.u1 = User.objects.create_user(email='rv2a@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='rv2b@example.com', password='Password123!')
        self.org1 = ensure_personal_org(self.u1)
        ensure_personal_org(self.u2)
        get_or_create_entitlement(self.org1)
        seed_render_catalog()
        self.design = None

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def _login(self, user):
        self.client.force_login(user)
        return self._csrf()

    def _ensure_design(self, token):
        if self.design:
            return self.design
        with patch('apps.designs.services.validate_geometry') as mock_validate:
            mock_validate.return_value = {'geometry_hash': 'geom-v2', 'ok': True}
            design = self.client.post(
                '/api/v1/designs/',
                data=json.dumps({'name': 'Box', 'product_slug': 'mailer-parametric-demo'}),
                content_type='application/json',
                HTTP_X_CSRFTOKEN=token,
            )
            self.assertEqual(design.status_code, 201, design.content)
            self.design = Design.objects.get(id=design.json()['data']['id'])
        return self.design

    def test_upgrade_v1_to_v2(self):
        v1 = {
            'schemaVersion': 'boxcraft.render_scene.v1',
            'camera': create_default_scene()['camera'],
            'light': create_default_scene()['light'],
            'background': create_default_scene()['background'],
            'ground': create_default_scene()['ground'],
            'output': {'aspect': '1:1'},
            'models': [],
        }
        v2 = upgrade_scene_to_v2(v1)
        self.assertEqual(v2['schemaVersion'], SCHEMA_VERSION)
        self.assertIn('props', v2)
        self.assertIn('environment', v2)
        self.assertIn('views', v2)
        validated = validate_render_scene(v2)
        self.assertEqual(validated['schemaVersion'], SCHEMA_VERSION)

    def test_seed_catalog(self):
        self.assertTrue(RenderProp.objects.filter(is_official=True).exists())
        self.assertTrue(RenderEnvironment.objects.filter(pk='studio_soft').exists())
        from apps.render_scenes.models import RenderSceneTemplate

        self.assertTrue(RenderSceneTemplate.objects.exists())

    def test_prop_upload_rejects_external_uri(self):
        token = self._login(self.u1)
        bad = SimpleUploadedFile('bad.glb', _minimal_glb(with_external_uri=True), content_type='model/gltf-binary')
        res = self.client.post(
            '/api/v1/render-props/',
            {'file': bad, 'name': 'evil'},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_GLB')

    def test_prop_upload_and_list(self):
        token = self._login(self.u1)
        good = SimpleUploadedFile('ok.glb', _minimal_glb(), content_type='model/gltf-binary')
        res = self.client.post(
            '/api/v1/render-props/',
            {'file': good, 'name': 'My Prop'},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(res.status_code, 201, res.content)
        mine = self.client.get('/api/v1/render-props/?scope=mine')
        self.assertEqual(mine.status_code, 200)
        self.assertTrue(any(i['name'] == 'My Prop' for i in mine.json()['data']['items']))

    def test_cross_org_scene_forbidden(self):
        token = self._login(self.u1)
        create = self.client.post(
            '/api/v1/render-scenes/',
            data=json.dumps({'name': 'S1', 'content': create_default_scene()}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        scene_id = create.json()['data']['id']
        self.client.logout()
        self._login(self.u2)
        res = self.client.get(f'/api/v1/render-scenes/{scene_id}/')
        self.assertEqual(res.status_code, 403)

    def test_apply_template(self):
        token = self._login(self.u1)
        design = self._ensure_design(token)
        create = self.client.post(
            '/api/v1/render-scenes/',
            data=json.dumps({'name': 'T', 'content': create_default_scene()}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        scene = create.json()['data']
        tpl = self.client.get('/api/v1/render-scene-templates/').json()['data']['items'][0]
        res = self.client.post(
            f'/api/v1/render-scenes/{scene["id"]}/apply-template/',
            data=json.dumps(
                {
                    'templateId': tpl['id'],
                    'expected_row_version': scene['row_version'],
                    'bindings': [{'slotId': 'main', 'designId': str(design.id)}],
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(res.status_code, 200, res.content)
        content = res.json()['data']['content']
        self.assertEqual(content['schemaVersion'], SCHEMA_VERSION)
        self.assertEqual(content['models'][0]['designId'], str(design.id))
        self.assertEqual(content['templateId'], tpl['id'])

    @patch('apps.render_scenes.jobs.call_render', return_value=PNG_1X1)
    def test_batch_render_quota(self, _mock):
        token = self._login(self.u1)
        design = self._ensure_design(token)
        content = create_default_scene()
        content['views'] = [
            {
                'id': 'view-a',
                'name': 'A',
                'camera': content['camera'],
                'output': {'aspect': '1:1'},
            },
            {
                'id': 'view-b',
                'name': 'B',
                'camera': content['camera'],
                'output': {'aspect': '1:1'},
            },
        ]
        content['models'] = [
            {
                'id': str(uuid.uuid4()),
                'designId': str(design.id),
                'revisionId': None,
                'position': {'x': 0, 'y': 0, 'z': 0},
                'rotation': {'x': 0, 'y': 0, 'z': 0},
                'scale': 1,
                'foldProgress': 100,
                'materialId': 'kraft',
            }
        ]
        create = self.client.post(
            '/api/v1/render-scenes/',
            data=json.dumps({'name': 'Batch', 'content': content}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        scene_id = create.json()['data']['id']
        glb = SimpleUploadedFile('scene.glb', _minimal_glb(), content_type='model/gltf-binary')
        res = self.client.post(
            f'/api/v1/render-scenes/{scene_id}/render-batches/',
            {
                'file': glb,
                'width': '1024',
                'height': '1024',
                'format': 'png',
                'view_ids': json.dumps(['view-a', 'view-b']),
                'scene_snapshot': json.dumps(content),
            },
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY='batch-1',
        )
        self.assertEqual(res.status_code, 202, res.content)
        batch = RenderBatch.objects.get(id=res.json()['data']['id'])
        self.assertEqual(batch.job_count, 2)
        self.assertEqual(RenderJob.objects.filter(batch=batch, status=RenderJob.Status.SUCCEEDED).count(), 2)

    @override_settings(RENDER_ALLOW_4K=False)
    def test_4k_disabled(self):
        token = self._login(self.u1)
        create = self.client.post(
            '/api/v1/render-scenes/',
            data=json.dumps({'name': '4k', 'content': create_default_scene()}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        scene_id = create.json()['data']['id']
        glb = SimpleUploadedFile('scene.glb', _minimal_glb(), content_type='model/gltf-binary')
        res = self.client.post(
            f'/api/v1/render-scenes/{scene_id}/render-jobs/',
            {'file': glb, 'width': '3840', 'height': '2160', 'format': 'png'},
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY='4k-1',
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()['code'], 'RENDER_4K_DISABLED')
