import json
import uuid
from unittest.mock import patch

from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from apps.accounts.models import User
from apps.ai_jobs.models import AiJob, UsageLedger, UsageReservation
from apps.ai_jobs.services import process_ai_job
from apps.assets.models import Asset
from apps.designs.models import Design
from apps.organizations.services import ensure_personal_org


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, AI_ALLOW_TEST_PROVIDER=True)
class AiJobsTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        call_command('seed_catalog')
        self.u1 = User.objects.create_user(email='ai1@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='ai2@example.com', password='Password123!')
        self.org1 = ensure_personal_org(self.u1)
        ensure_personal_org(self.u2)

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def _login(self, user):
        self.client.force_login(user)
        return self._csrf()

    def _create_design(self, user, slug='import-102040'):
        token = self._login(user)
        r = self.client.post(
            '/api/v1/designs/',
            data=json.dumps({'name': 'AI Design', 'product_slug': slug}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()['data']

    def _registration(self, design_data, *, geometry_hash=None):
        geom_hash = geometry_hash
        if geom_hash is None:
            geom_hash = design_data['content']['geometry']['geometryHash']
        return {
            'geometryHash': geom_hash,
            'maskHash': 'test-mask-hash',
            'polarity': 'white_printable',
            'printableMask': [[0, 0, 100, 0, 100, 80, 0, 80, 0, 0]],
            'totalMask': [[0, 0, 100, 0, 100, 80, 0, 80, 0, 0]],
            'mainMask': [[10, 10, 90, 10, 90, 70, 10, 70, 10, 10]],
            'netBoundingBoxMm': {'minX': 0, 'minY': 0, 'widthMm': 100, 'heightMm': 80},
            'pxPerMm': 4,
            'maxEdgePx': 1024,
        }

    @override_settings(AI_PROVIDER='disabled')
    def test_disabled_capability_and_post_rejected(self):
        design = self._create_design(self.u1)
        caps = self.client.get('/api/v1/ai/capabilities/')
        self.assertEqual(caps.status_code, 200)
        ops = {o['operation']: o for o in caps.json()['data']['operations']}
        self.assertFalse(ops['image_generate']['enabled'])
        self.assertFalse(ops['main_area_generate']['enabled'])
        token = self._csrf()
        before_jobs = AiJob.objects.count()
        before_assets = Asset.objects.count()
        for operation in ('image_generate', 'main_area_generate'):
            bad = self.client.post(
                f'/api/v1/designs/{design["id"]}/ai-jobs/',
                data=json.dumps({'operation': operation, 'prompt': 'red box'}),
                content_type='application/json',
                HTTP_X_CSRFTOKEN=token,
                HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
            )
            self.assertEqual(bad.status_code, 400)
            self.assertEqual(bad.json()['code'], 'CAPABILITY_UNAVAILABLE')
        self.assertEqual(AiJob.objects.count(), before_jobs)
        self.assertEqual(Asset.objects.count(), before_assets)

    @override_settings(AI_PROVIDER='test', DEBUG=True)
    def test_image_generate_idempotent_and_asset(self):
        design = self._create_design(self.u1)
        token = self._csrf()
        key = 'ai-idem-1'
        payload = json.dumps({'operation': 'image_generate', 'prompt': 'kraft mailer art'})
        r1 = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=payload,
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=key,
        )
        self.assertEqual(r1.status_code, 202, r1.content)
        job1 = r1.json()['data']
        self.assertEqual(job1['status'], 'succeeded')
        self.assertIsNotNone(job1['result_asset_id'])
        token = self._csrf()
        r2 = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=payload,
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=key,
        )
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()['data']['id'], job1['id'])
        self.assertEqual(AiJob.objects.filter(idempotency_key=key).count(), 1)
        self.assertEqual(Asset.objects.filter(id=job1['result_asset_id']).count(), 1)
        self.assertEqual(UsageReservation.objects.filter(job_id=job1['id'], status='settled').count(), 1)

    @override_settings(AI_PROVIDER='test', DEBUG=True)
    def test_process_replay_no_double_asset(self):
        design = self._create_design(self.u1)
        token = self._csrf()
        r = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps({'operation': 'image_generate', 'prompt': 'once'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        job_id = r.json()['data']['id']
        asset_id = r.json()['data']['result_asset_id']
        process_ai_job(job_id)
        process_ai_job(job_id)
        self.assertEqual(Asset.objects.filter(source='ai_generate').count(), 1)
        self.assertEqual(UsageLedger.objects.filter(job_id=job_id).count(), 1)
        job = AiJob.objects.get(pk=job_id)
        self.assertEqual(str(job.result_asset_id), asset_id)

    @override_settings(AI_PROVIDER='test', DEBUG=True)
    def test_cross_org_forbidden(self):
        design = self._create_design(self.u1)
        token = self._csrf()
        r = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps({'operation': 'image_generate', 'prompt': 'x'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        job_id = r.json()['data']['id']
        self.client.logout()
        self._login(self.u2)
        g = self.client.get(f'/api/v1/ai-jobs/{job_id}/')
        self.assertEqual(g.status_code, 403)
        token = self._csrf()
        a = self.client.post(
            f'/api/v1/ai-jobs/{job_id}/apply/',
            data=json.dumps({'expected_row_version': 1, 'panel_id': 'front'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(a.status_code, 403)

    @override_settings(AI_PROVIDER='test', DEBUG=True)
    @patch('apps.designs.services.validate_geometry')
    def test_apply_success_and_row_conflict(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'g-ai', 'ok': True}
        design = self._create_design(self.u1, slug='mailer-parametric-demo')
        token = self._csrf()
        job_r = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps({'operation': 'image_generate', 'prompt': 'apply me'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(job_r.status_code, 202, job_r.content)
        job = job_r.json()['data']
        detail = self.client.get(f'/api/v1/designs/{design["id"]}/')
        row = detail.json()['data']['row_version']
        token = self._csrf()
        ok = self.client.post(
            f'/api/v1/ai-jobs/{job["id"]}/apply/',
            data=json.dumps({'expected_row_version': row, 'panel_id': 'front'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertGreaterEqual(len(ok.json()['data']['content']['artwork']['layers']), 1)
        token = self._csrf()
        conflict = self.client.post(
            f'/api/v1/ai-jobs/{job["id"]}/apply/',
            data=json.dumps({'expected_row_version': row, 'panel_id': 'front'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()['code'], 'DESIGN_VERSION_CONFLICT')

    @override_settings(AI_PROVIDER='test', DEBUG=True)
    @patch('apps.designs.services.validate_geometry')
    def test_main_area_generate_and_apply_net_mm(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'g-main', 'ok': True}
        design = self._create_design(self.u1, slug='mailer-parametric-demo')
        caps = self.client.get('/api/v1/ai/capabilities/')
        self.assertEqual(caps.status_code, 200)
        ops = {o['operation']: o for o in caps.json()['data']['operations']}
        self.assertTrue(ops['main_area_generate']['enabled'])
        self.assertFalse(ops['main_area_generate'].get('mask_input'))

        token = self._csrf()
        job_r = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps(
                {
                    'operation': 'main_area_generate',
                    'prompt': 'full dieline art',
                    'registration': self._registration(design),
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(job_r.status_code, 202, job_r.content)
        job = job_r.json()['data']
        self.assertEqual(job['status'], 'succeeded')
        self.assertEqual(job['operation'], 'main_area_generate')
        self.assertIsNotNone(job['result_asset_id'])
        self.assertEqual(
            UsageLedger.objects.filter(job_id=job['id'], reason='ai_main_area_generate').count(),
            1,
        )

        gallery = self.client.get(f'/api/v1/designs/{design["id"]}/generated-assets/')
        self.assertEqual(gallery.status_code, 200)
        items = gallery.json()['data']['items']
        self.assertTrue(any(i['job_id'] == job['id'] and i.get('operation') == 'main_area_generate' for i in items))

        detail = self.client.get(f'/api/v1/designs/{design["id"]}/')
        row = detail.json()['data']['row_version']
        token = self._csrf()
        ok = self.client.post(
            f'/api/v1/ai-jobs/{job["id"]}/apply/',
            data=json.dumps(
                {
                    'expected_row_version': row,
                    'width_mm': 420,
                    'height_mm': 310,
                    'origin_x_mm': 12.5,
                    'origin_y_mm': 8,
                    'side': 'outside',
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        content = ok.json()['data']['content']
        layers = content['artwork']['layers']
        net = next(l for l in layers if l.get('coordinateSpace') == 'net_mm')
        self.assertIsNone(net.get('panelId'))
        self.assertEqual(net['widthMm'], 420)
        self.assertEqual(net['heightMm'], 310)
        self.assertEqual(net['transform']['xMm'], 12.5)
        self.assertEqual(net['transform']['yMm'], 8)
        self.assertEqual(net['clip'], 'printable')
        self.assertEqual(content['aiSettings']['mode'], 'main_area')

        # image_generate still requires panel_id
        token = self._csrf()
        img_job = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps({'operation': 'image_generate', 'prompt': 'panel sticker'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(img_job.status_code, 202, img_job.content)
        detail2 = self.client.get(f'/api/v1/designs/{design["id"]}/')
        row2 = detail2.json()['data']['row_version']
        token = self._csrf()
        bad_panel = self.client.post(
            f'/api/v1/ai-jobs/{img_job.json()["data"]["id"]}/apply/',
            data=json.dumps({'expected_row_version': row2}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(bad_panel.status_code, 400)
        self.assertEqual(bad_panel.json()['code'], 'VALIDATION_ERROR')

    @override_settings(AI_PROVIDER='test', DEBUG=True)
    @patch('apps.designs.services.validate_geometry')
    def test_main_area_apply_registration_and_mismatch(self, mock_validate):
        mock_validate.return_value = {'geometry_hash': 'g-reg', 'ok': True}
        design = self._create_design(self.u1, slug='mailer-parametric-demo')
        registration = self._registration(design)
        registration['maskHash'] = 'abc123'
        token = self._csrf()
        job_r = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps(
                {
                    'operation': 'main_area_generate',
                    'prompt': 'reg art',
                    'registration': registration,
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(job_r.status_code, 202, job_r.content)
        job_id = job_r.json()['data']['id']

        detail = self.client.get(f'/api/v1/designs/{design["id"]}/')
        data = detail.json()['data']
        row = data['row_version']
        token = self._csrf()
        ok = self.client.post(
            f'/api/v1/ai-jobs/{job_id}/apply/',
            data=json.dumps(
                {
                    'expected_row_version': row,
                    'width_mm': 100,
                    'height_mm': 80,
                    'origin_x_mm': 0,
                    'origin_y_mm': 0,
                    'registration': registration,
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        content = ok.json()['data']['content']
        self.assertEqual(content['aiSettings']['registration']['maskHash'], 'abc123')
        self.assertEqual(content['artwork']['layers'][-1]['clip'], 'printable')

        # create rejects stale geometryHash
        token = self._csrf()
        bad_create = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps(
                {
                    'operation': 'main_area_generate',
                    'prompt': 'reg art 2',
                    'registration': {**registration, 'geometryHash': 'stale-hash-not-current'},
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(bad_create.status_code, 400)
        self.assertEqual(bad_create.json()['code'], 'GEOMETRY_MISMATCH')

        # second job + apply mismatched hash
        token = self._csrf()
        job2 = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps(
                {
                    'operation': 'main_area_generate',
                    'prompt': 'reg art 3',
                    'registration': registration,
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(job2.status_code, 202, job2.content)
        detail2 = self.client.get(f'/api/v1/designs/{design["id"]}/')
        row2 = detail2.json()['data']['row_version']
        bad_reg = {**registration, 'geometryHash': 'stale-hash-not-current'}
        token = self._csrf()
        mismatch = self.client.post(
            f'/api/v1/ai-jobs/{job2.json()["data"]["id"]}/apply/',
            data=json.dumps(
                {
                    'expected_row_version': row2,
                    'width_mm': 100,
                    'height_mm': 80,
                    'origin_x_mm': 0,
                    'origin_y_mm': 0,
                    'registration': bad_reg,
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(mismatch.status_code, 400)
        self.assertEqual(mismatch.json()['code'], 'GEOMETRY_MISMATCH')

    @override_settings(AI_PROVIDER='test', DEBUG=True)
    def test_main_area_create_requires_registration(self):
        design = self._create_design(self.u1, slug='mailer-parametric-demo')
        token = self._csrf()
        missing = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps({'operation': 'main_area_generate', 'prompt': 'no reg'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(missing.json()['code'], 'VALIDATION_ERROR')

    @override_settings(AI_PROVIDER='test', DEBUG=True)
    @patch('apps.ai_jobs.providers.test.TestProvider.generate_image')
    def test_main_area_passes_mask_png_to_provider(self, mock_gen):
        from apps.ai_jobs.providers.test import _PNG

        mock_gen.return_value = _PNG
        design = self._create_design(self.u1, slug='mailer-parametric-demo')
        token = self._csrf()
        job_r = self.client.post(
            f'/api/v1/designs/{design["id"]}/ai-jobs/',
            data=json.dumps(
                {
                    'operation': 'main_area_generate',
                    'prompt': 'mask feed',
                    'registration': self._registration(design),
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(job_r.status_code, 202, job_r.content)
        self.assertTrue(mock_gen.called)
        kwargs = mock_gen.call_args.kwargs
        self.assertIn('mask_png', kwargs)
        self.assertTrue(kwargs['mask_png'].startswith(b'\x89PNG\r\n\x1a\n'))
        self.assertEqual(kwargs.get('mask_mime'), 'image/png')
        job = AiJob.objects.get(pk=job_r.json()['data']['id'])
        self.assertEqual((job.meta or {}).get('maskHash'), 'test-mask-hash')

    def test_rasterize_mask_png_has_white_pixels(self):
        from apps.ai_jobs.masks import rasterize_mask_png

        png = rasterize_mask_png(
            {
                'geometryHash': 'g',
                'maskHash': 'h',
                'polarity': 'white_printable',
                'mainMask': [[0, 0, 50, 0, 50, 40, 0, 40, 0, 0]],
                'netBoundingBoxMm': {'minX': 0, 'minY': 0, 'widthMm': 50, 'heightMm': 40},
                'pxPerMm': 4,
                'maxEdgePx': 1024,
            }
        )
        self.assertTrue(png.startswith(b'\x89PNG\r\n\x1a\n'))
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(png))
        self.assertEqual(img.mode, 'L')
        self.assertGreater(max(img.getdata()), 0)


class GeminiProviderMaskTests(TestCase):
    @override_settings(AI_API_KEY='test-key', AI_MODEL='gemini-2.5-flash-image')
    @patch('apps.ai_jobs.providers.gemini_images.requests.post')
    def test_gemini_payload_includes_inline_mask(self, mock_post):
        import base64

        from apps.ai_jobs.providers.gemini_images import GeminiImagesProvider
        from apps.ai_jobs.providers.test import _PNG

        mock_resp = mock_post.return_value
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            'candidates': [
                {
                    'content': {
                        'parts': [
                            {
                                'inlineData': {
                                    'mimeType': 'image/png',
                                    'data': base64.b64encode(_PNG).decode('ascii'),
                                }
                            }
                        ]
                    }
                }
            ]
        }
        out = GeminiImagesProvider().generate_image('hello', mask_png=_PNG, mask_mime='image/png')
        self.assertEqual(out, _PNG)
        payload = mock_post.call_args.kwargs['json']
        parts = payload['contents'][0]['parts']
        self.assertEqual(parts[0]['text'], 'hello')
        self.assertIn('inlineData', parts[1])
        self.assertEqual(parts[1]['inlineData']['mimeType'], 'image/png')
        self.assertTrue(parts[1]['inlineData']['data'])
