import json
import uuid
from unittest.mock import patch

from django.core.management import call_command
from django.test import Client, TestCase

from apps.accounts.models import User
from apps.organizations.services import ensure_personal_org
from apps.render_scenes.document import create_default_scene


class RenderScenesTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')
        self.u1 = User.objects.create_user(email='rs1@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='rs2@example.com', password='Password123!')
        self.org1 = ensure_personal_org(self.u1)
        ensure_personal_org(self.u2)

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def _login(self, user):
        self.client.force_login(user)
        return self._csrf()

    @patch('apps.designs.services.validate_geometry')
    def _create_design(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'geom-rs', 'ok': True}
        token = self._login(self.u1)
        create = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'Box A', 'product_slug': 'mailer-parametric-demo'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        return create.json()['data'], token

    def test_create_list_get_patch_copy_delete(self):
        design, token = self._create_design()
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
        create = self.client.post(
            '/api/v1/render-scenes/',
            data=json.dumps({'name': 'Scene 1', 'content': content}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        scene = create.json()['data']
        self.assertEqual(scene['name'], 'Scene 1')
        self.assertEqual(scene['row_version'], 1)
        self.assertEqual(len(scene['content']['models']), 1)

        listed = self.client.get('/api/v1/render-scenes/')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()['data']['total'], 1)

        detail = self.client.get(f'/api/v1/render-scenes/{scene["id"]}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['data']['id'], scene['id'])

        patch = self.client.patch(
            f'/api/v1/render-scenes/{scene["id"]}/',
            data=json.dumps(
                {
                    'expected_row_version': 1,
                    'name': 'Scene 1b',
                    'content': scene['content'],
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(patch.status_code, 200, patch.content)
        self.assertEqual(patch.json()['data']['name'], 'Scene 1b')
        self.assertEqual(patch.json()['data']['row_version'], 2)

        conflict = self.client.patch(
            f'/api/v1/render-scenes/{scene["id"]}/',
            data=json.dumps({'expected_row_version': 1, 'name': 'stale'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()['code'], 'ROW_VERSION_CONFLICT')

        copied = self.client.post(
            f'/api/v1/render-scenes/{scene["id"]}/copy/',
            data=json.dumps({}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(copied.status_code, 201, copied.content)
        self.assertIn('副本', copied.json()['data']['name'])
        self.assertEqual(copied.json()['data']['row_version'], 1)

        deleted = self.client.delete(
            f'/api/v1/render-scenes/{scene["id"]}/',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(deleted.status_code, 200)

    def test_cross_org_forbidden(self):
        design, token = self._create_design()
        create = self.client.post(
            '/api/v1/render-scenes/',
            data=json.dumps({'name': 'Private', 'design_id': design['id']}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(create.status_code, 201, create.content)
        scene_id = create.json()['data']['id']

        self.client.logout()
        self._login(self.u2)
        r = self.client.get(f'/api/v1/render-scenes/{scene_id}/')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json()['code'], 'FORBIDDEN')

    def test_foreign_design_rejected(self):
        design, _token = self._create_design()
        self.client.logout()
        token2 = self._login(self.u2)
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
        create = self.client.post(
            '/api/v1/render-scenes/',
            data=json.dumps({'name': 'Steal', 'content': content}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token2,
        )
        self.assertEqual(create.status_code, 400, create.content)
        self.assertEqual(create.json()['code'], 'DESIGN_NOT_FOUND')
