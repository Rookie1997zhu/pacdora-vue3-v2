import json
import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from apps.accounts.models import User
from apps.assets.models import Asset
from apps.designs.models import DesignRevision
from apps.organizations.services import ensure_personal_org

# 1x1 PNG
PNG_1X1 = bytes.fromhex(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
    '0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082'
)


def _base_content(*, template_id='mailer-parametric-demo', mode='parametric', asset_id=None, length=300):
    layers = []
    if asset_id:
        layers.append(
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
                'assetId': asset_id,
                'text': None,
                'shape': None,
                'crop': None,
                'resizePolicy': 'keep_mm',
                'anchor': None,
            }
        )
    return {
        'schemaVersion': 'boxcraft.design.v1',
        'locale': 'zh-CN',
        'geometry': {
            'mode': mode,
            'templateId': template_id,
            'templateVersion': '1',
            'engineVersion': 'boxcraft.knife.v3',
            'params': {
                'lengthMm': length,
                'widthMm': 200,
                'heightMm': 50,
                'thicknessMm': 1.5,
                'sizeMode': 'inner',
                'fluteDirection': 'L',
                'materialId': 'kraft',
                'bleedInputMm': 3,
                'advanced': {},
            },
            'geometryHash': 'pending',
        },
        'artwork': {'backgroundColor': None, 'layers': layers},
        'aiSettings': None,
        'outbox': {
            'enabled': False,
            'sizingMode': 'grow',
            'quantity': 1,
            'thicknessMm': 3,
            'gapsMm': {'length': 5, 'width': 5, 'height': 5},
        },
    }


class AssetsDesignsTests(TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        media_override = override_settings(MEDIA_ROOT=Path(self._tmpdir.name))
        media_override.enable()
        self.addCleanup(media_override.disable)

        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')

        self.u1 = User.objects.create_user(email='d1@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='d2@example.com', password='Password123!')
        self.org1 = ensure_personal_org(self.u1)
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

    def test_product_list_published(self):
        r = self.client.get('/api/v1/products/')
        self.assertEqual(r.status_code, 200)
        items = r.json()['data']['items']
        self.assertGreaterEqual(len(items), 1)
        modes = {p['geometry_mode'] for p in items}
        self.assertIn('parametric', modes)
        self.assertIn('fixed_snapshot', modes)

    def test_asset_upload_and_auth_download(self):
        data = self._upload_png(self.u1)
        asset_id = data['id']
        self.assertEqual(data['status'], 'ready')
        content = self.client.get(f'/api/v1/assets/{asset_id}/content/')
        self.assertEqual(content.status_code, 200)
        self.assertEqual(content['Content-Type'], 'image/png')
        body = b''.join(content.streaming_content)
        content.close()
        self.assertEqual(body[:8], b'\x89PNG\r\n\x1a\n')

    def test_cross_org_asset_forbidden(self):
        data = self._upload_png(self.u1)
        self.client.logout()
        self._login(self.u2)
        r = self.client.get(f'/api/v1/assets/{data["id"]}/')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json()['code'], 'FORBIDDEN')
        c = self.client.get(f'/api/v1/assets/{data["id"]}/content/')
        self.assertEqual(c.status_code, 403)

    @patch('apps.designs.services.validate_geometry')
    def test_design_create_save_reopen(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'geom-abc', 'ok': True}
        asset = self._upload_png(self.u1)
        token = self._csrf()
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'Demo', 'product_slug': 'mailer-parametric-demo'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        design = create.json()['data']
        design_id = design['id']
        row_version = design['row_version']
        content = design['content']
        self.assertIsNotNone(content)
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
        content['geometry']['params']['lengthMm'] = 320
        token = self._csrf()
        save = self.client.post(
            f'/api/v1/designs/{design_id}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': row_version}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(save.status_code, 201, save.content)
        saved = save.json()['data']
        self.assertEqual(saved['content']['geometry']['geometryHash'], 'geom-abc')
        self.assertEqual(saved['revision']['revision_no'], 2)

        # new session
        self.client.logout()
        self._login(self.u1)
        reopen = self.client.get(f'/api/v1/designs/{design_id}/')
        self.assertEqual(reopen.status_code, 200)
        body = reopen.json()['data']
        self.assertEqual(body['content']['geometry']['params']['lengthMm'], 320)
        self.assertEqual(body['content']['artwork']['layers'][0]['assetId'], asset['id'])
        self.assertEqual(body['content']['geometry']['geometryHash'], 'geom-abc')

    @patch('apps.designs.services.validate_geometry')
    def test_row_version_conflict(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'g1', 'ok': True}
        token = self._login(self.u1)
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'C', 'product_slug': 'mailer-parametric-demo'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        design = create.json()['data']
        content = design['content']
        content['geometry']['params']['widthMm'] = 210
        token = self._csrf()
        ok1 = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(ok1.status_code, 201, ok1.content)
        content2 = json.loads(json.dumps(content))
        content2['geometry']['params']['widthMm'] = 220
        token = self._csrf()
        conflict = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content2, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()['code'], 'DESIGN_VERSION_CONFLICT')
        self.assertIn('row_version', conflict.json()['data'])

    @patch('apps.designs.services.validate_geometry')
    def test_idempotency_replay(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'g-idem', 'ok': True}
        token = self._login(self.u1)
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'I', 'product_slug': 'mailer-parametric-demo'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        design = create.json()['data']
        content = design['content']
        content['geometry']['params']['heightMm'] = 55
        key = 'idem-key-1'
        payload = json.dumps({'content': content, 'expected_row_version': design['row_version']})
        token = self._csrf()
        r1 = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=payload,
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=key,
        )
        self.assertEqual(r1.status_code, 201, r1.content)
        rev_no = r1.json()['data']['revision']['revision_no']
        token = self._csrf()
        r2 = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=payload,
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=key,
        )
        self.assertEqual(r2.status_code, 201)
        self.assertEqual(r2.json()['data']['revision']['revision_no'], rev_no)
        self.assertEqual(DesignRevision.objects.filter(design_id=design['id']).count(), 2)

    def test_cross_org_design_forbidden(self):
        token = self._login(self.u1)
        # fixed_snapshot avoids geometry service
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'X', 'product_slug': 'import-102040'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        design_id = create.json()['data']['id']
        self.client.logout()
        self._login(self.u2)
        r = self.client.get(f'/api/v1/designs/{design_id}/')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json()['code'], 'FORBIDDEN')

    def test_foreign_or_not_ready_asset_rejected(self):
        foreign = self._upload_png(self.u2)
        token = self._login(self.u1)
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'A', 'product_slug': 'import-102040'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
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
                'assetId': foreign['id'],
                'text': None,
                'shape': None,
                'crop': None,
                'resizePolicy': 'keep_mm',
                'anchor': None,
            }
        ]
        token = self._csrf()
        bad = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.json()['code'], 'ASSET_NOT_FOUND')

        # not ready asset in same org
        pending = Asset.objects.create(
            organization=self.org1,
            owner=self.u1,
            storage_key='orgs/x/pending.bin',
            original_filename='p.png',
            mime='image/png',
            byte_size=1,
            sha256='abc',
            status=Asset.Status.UPLOADING,
            source='upload',
        )
        content['artwork']['layers'][0]['assetId'] = str(pending.id)
        token = self._csrf()
        bad2 = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(bad2.status_code, 400)
        self.assertEqual(bad2.json()['code'], 'ASSET_NOT_READY')

    @patch('apps.designs.services.validate_geometry')
    def test_text_shape_crop_revision(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'g-p32', 'ok': True}
        asset = self._upload_png(self.u1)
        token = self._csrf()
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'P32', 'product_slug': 'mailer-parametric-demo'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        design = create.json()['data']
        content = design['content']
        content['artwork']['layers'] = [
            {
                'id': 'text-1',
                'kind': 'text',
                'name': 'Hello',
                'coordinateSpace': 'panel_mm',
                'panelId': 'front',
                'pieceId': None,
                'side': 'outside',
                'transform': {'xMm': 8, 'yMm': 8, 'rotationDeg': 0, 'scaleX': 1, 'scaleY': 1},
                'widthMm': 50,
                'heightMm': 16,
                'visible': True,
                'locked': False,
                'opacity': 1,
                'zIndex': 1,
                'clip': 'panel',
                'assetId': None,
                'text': {
                    'content': 'Hello',
                    'fontFamily': 'Noto Sans SC',
                    'fontSizeMm': 8,
                    'fill': '#16343c',
                    'align': 'left',
                },
                'shape': None,
                'crop': None,
                'resizePolicy': 'keep_mm',
                'anchor': None,
            },
            {
                'id': 'shape-1',
                'kind': 'shape',
                'name': 'rect',
                'coordinateSpace': 'panel_mm',
                'panelId': 'front',
                'pieceId': None,
                'side': 'outside',
                'transform': {'xMm': 12, 'yMm': 20, 'rotationDeg': 0, 'scaleX': 1, 'scaleY': 1},
                'widthMm': 30,
                'heightMm': 20,
                'visible': True,
                'locked': False,
                'opacity': 1,
                'zIndex': 2,
                'clip': 'panel',
                'assetId': None,
                'text': None,
                'shape': {
                    'shapeType': 'rect',
                    'fill': '#0f6e6833',
                    'stroke': '#0f6e68',
                    'strokeWidthMm': 0.4,
                },
                'crop': None,
                'resizePolicy': 'keep_mm',
                'anchor': None,
            },
            {
                'id': 'img-1',
                'kind': 'image',
                'name': 'art',
                'coordinateSpace': 'panel_mm',
                'panelId': 'front',
                'pieceId': None,
                'side': 'outside',
                'transform': {'xMm': 10, 'yMm': 40, 'rotationDeg': 0, 'scaleX': 1, 'scaleY': 1},
                'widthMm': 40,
                'heightMm': 40,
                'visible': True,
                'locked': False,
                'opacity': 1,
                'zIndex': 3,
                'clip': 'panel',
                'assetId': asset['id'],
                'text': None,
                'shape': None,
                'crop': {'x': 0.1, 'y': 0.1, 'w': 0.8, 'h': 0.8},
                'resizePolicy': 'keep_mm',
                'anchor': None,
            },
        ]
        token = self._csrf()
        ok = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        saved_layers = ok.json()['data']['content']['artwork']['layers']
        self.assertEqual(len(saved_layers), 3)
        self.assertEqual(saved_layers[0]['text']['content'], 'Hello')
        self.assertEqual(saved_layers[1]['shape']['shapeType'], 'rect')
        self.assertEqual(saved_layers[2]['crop']['w'], 0.8)

        bad_content = json.loads(json.dumps(content))
        bad_content['artwork']['layers'][0]['text'] = {'content': 'x'}
        token = self._csrf()
        bad_text = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps(
                {'content': bad_content, 'expected_row_version': ok.json()['data']['row_version']}
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(bad_text.status_code, 400)
        self.assertEqual(bad_text.json()['code'], 'VALIDATION_ERROR')

        bad_crop = json.loads(json.dumps(content))
        bad_crop['artwork']['layers'][2]['crop'] = {'x': 0.8, 'y': 0.8, 'w': 0.5, 'h': 0.5}
        token = self._csrf()
        bad_crop_r = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps(
                {'content': bad_crop, 'expected_row_version': ok.json()['data']['row_version']}
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(bad_crop_r.status_code, 400)
        self.assertEqual(bad_crop_r.json()['code'], 'VALIDATION_ERROR')

    def test_fixed_snapshot_size_locked_reject_and_accept(self):
        from apps.catalog.models import TemplateVersion

        ver = TemplateVersion.objects.get(template__template_key='fixed-102040', version='1')
        locked = (ver.param_schema or {}).get('locked_dims') or {}
        self.assertEqual(locked.get('lengthMm'), 300)
        self.assertEqual(locked.get('widthMm'), 150)
        self.assertEqual(locked.get('heightMm'), 181.5)

        token = self._login(self.u1)
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'Lock', 'product_slug': 'import-102040'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        design = create.json()['data']
        self.assertEqual(design['content']['geometry']['mode'], 'fixed_snapshot')
        revs_before = DesignRevision.objects.filter(design_id=design['id']).count()

        content = design['content']
        content['geometry']['params']['lengthMm'] = 999
        token = self._csrf()
        bad = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(bad.status_code, 400, bad.content)
        self.assertEqual(bad.json()['code'], 'SIZE_LOCKED')
        self.assertEqual(DesignRevision.objects.filter(design_id=design['id']).count(), revs_before)

        content['geometry']['params']['lengthMm'] = 300
        content['geometry']['params']['widthMm'] = 150
        content['geometry']['params']['heightMm'] = 181.5
        token = self._csrf()
        ok = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        geom = ok.json()['data']['content']['geometry']
        self.assertEqual(geom['mode'], 'fixed_snapshot')
        self.assertTrue(str(geom['geometryHash']).startswith('fixed:fixed-102040:'))

    @patch('apps.designs.services.validate_geometry')
    def test_parametric_out_of_range_still_rejected(self, mock_validate):
        from apps.catalog.models import TemplateVersion
        from apps.geometry_api.client import GeometryServiceError

        mock_validate.return_value = {'geometry_hash': 'g-ok', 'ok': True}
        token = self._login(self.u1)
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'Range', 'product_slug': 'mailer-parametric-demo'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        design = create.json()['data']
        content = design['content']
        content['geometry']['params']['lengthMm'] = 10
        mock_validate.side_effect = GeometryServiceError(
            'length_mm out of range [80, 1200]',
            code='OUT_OF_RANGE',
            status_code=400,
            payload={'field': 'length_mm'},
        )
        token = self._csrf()
        bad = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(bad.status_code, 400, bad.content)
        self.assertEqual(bad.json()['code'], 'OUT_OF_RANGE')

        ver = TemplateVersion.objects.get(template__template_key='mailer-parametric-demo', version='1')
        self.assertEqual(ver.limits.get('length'), [80, 1200])

    @patch('apps.designs.services.validate_geometry')
    def test_parametric_local_limits_reject_even_if_geometry_ok(self, mock_validate):
        from apps.catalog.models import TemplateVersion

        mock_validate.return_value = {'geometry_hash': 'g-always-ok', 'ok': True}
        token = self._login(self.u1)
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'LocalLimits', 'product_slug': 'mailer-parametric-demo'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        design = create.json()['data']
        self.assertEqual(design.get('param_limits', {}).get('length'), [80, 1200])
        calls_after_create = mock_validate.call_count

        content = design['content']
        content['geometry']['params']['lengthMm'] = 10
        token = self._csrf()
        bad = self.client.post(
            f'/api/v1/designs/{design["id"]}/revisions/',
            data=json.dumps({'content': content, 'expected_row_version': design['row_version']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(bad.status_code, 400, bad.content)
        self.assertEqual(bad.json()['code'], 'OUT_OF_RANGE')
        self.assertEqual(bad.json()['errors'].get('field'), 'length_mm')
        self.assertEqual(mock_validate.call_count, calls_after_create)

        detail = self.client.get(f'/api/v1/designs/{design["id"]}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['data']['param_limits'].get('length'), [80, 1200])

        ver = TemplateVersion.objects.get(template__template_key='mailer-parametric-demo', version='1')
        self.assertEqual(ver.limits.get('width'), [70, 1200])
        self.assertEqual(ver.limits.get('height'), [20, 600])
