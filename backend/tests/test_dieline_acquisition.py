import json
import tempfile
import zipfile
from pathlib import Path

from django.test import Client, TestCase, override_settings

from apps.accounts.models import User
from apps.dieline_library.models import AcquisitionJob, AcquisitionPlan, AssetVariant
from apps.dieline_library.services.adapters.policy import (
    default_packative_policy_path,
    disabled_packative_policy_path,
)
from apps.dieline_library.services.adapters.runner import create_job, dry_run_plan, process_job, validate_plan
from apps.dieline_library.services.adapters.supplier_package import SupplierPackageAdapter
from apps.dieline_library.tasks import dispatch_acquisition_job
from apps.organizations.services import ensure_personal_org

SAFE_SVG = b"""<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>
"""


class DielineAcquisitionTests(TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        media_override = override_settings(MEDIA_ROOT=Path(self._tmpdir.name) / 'media')
        media_override.enable()
        self.addCleanup(media_override.disable)

        self.root = Path(self._tmpdir.name) / 'pkg'
        self.root.mkdir()
        (self.root / 'ok.svg').write_bytes(SAFE_SVG)
        self.manifest = self.root / 'manifest.json'
        self.manifest.write_text(
            json.dumps(
                {
                    'provider': 'local_manifest',
                    'assets': [
                        {
                            'title': {'zh': 'Acq Box'},
                            'family_name': 'Acq Family',
                            'source_template_id': 'acq1',
                            'template_revision': '1',
                            'dimensions': {
                                'length_mm': 100,
                                'width_mm': 80,
                                'height_mm': 50,
                                'basis': 'unknown',
                            },
                            'files': [{'path': 'ok.svg', 'mime': 'image/svg+xml'}],
                            'rights': {
                                'grant_status': 'granted',
                                'permissions': {
                                    'can_store': True,
                                    'can_use_internally': True,
                                    'can_redistribute_files': True,
                                    'can_show_public_preview': True,
                                },
                            },
                            'quality': {
                                'publication_status': 'published',
                                'manufacturing_status': 'reference_only',
                            },
                        }
                    ],
                }
            ),
            encoding='utf-8',
        )

        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(email='acq@example.com', password='Password123!')
        self.org = ensure_personal_org(self.user)

    def _csrf(self):
        self.client.get('/api/v1/auth/csrf/')
        return self.client.cookies.get('csrftoken').value

    def _login(self):
        token = self._csrf()
        r = self.client.post(
            '/api/v1/auth/login/',
            data=json.dumps({'email': 'acq@example.com', 'password': 'Password123!'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 200)
        return self._csrf()

    def _local_plan(self, **kwargs):
        return AcquisitionPlan.objects.create(
            organization=self.org,
            adapter_type=AcquisitionPlan.AdapterType.LOCAL_MANIFEST,
            enabled=True,
            status=AcquisitionPlan.Status.READY,
            title='local',
            policy_json={
                'manifest_path': str(self.manifest),
                'files_root': str(self.root),
            },
            **kwargs,
        )

    def test_local_manifest_dry_run_no_write(self):
        plan = self._local_plan()
        report = dry_run_plan(plan, owner=self.user)
        self.assertFalse(report.blocked)
        self.assertGreater(report.planned_count, 0)
        self.assertIn('planned_count', report.budget_estimate)
        self.assertEqual(AssetVariant.objects.count(), 0)

    def test_supplier_package_zip_execute_idempotent(self):
        zip_path = Path(self._tmpdir.name) / 'pkg.zip'
        with zipfile.ZipFile(zip_path, 'w') as zf:
            zf.write(self.manifest, arcname='manifest.json')
            zf.write(self.root / 'ok.svg', arcname='ok.svg')

        plan = AcquisitionPlan.objects.create(
            organization=self.org,
            adapter_type=AcquisitionPlan.AdapterType.SUPPLIER_PACKAGE,
            enabled=True,
            status=AcquisitionPlan.Status.READY,
            title='supplier',
            policy_json={'package_path': str(zip_path)},
        )
        dry = dry_run_plan(plan, owner=self.user)
        self.assertFalse(dry.blocked)
        self.assertGreater(dry.planned_count, 0)

        job1 = create_job(plan=plan, owner=self.user, dry_run=False)
        r1 = process_job(str(job1.id))
        self.assertEqual(r1['status'], AcquisitionJob.Status.SUCCEEDED)
        self.assertEqual(AssetVariant.objects.filter(is_example=False).count(), 1)

        job2 = create_job(plan=plan, owner=self.user, dry_run=False)
        r2 = process_job(str(job2.id))
        self.assertEqual(r2['status'], AcquisitionJob.Status.SUCCEEDED)
        self.assertEqual(AssetVariant.objects.filter(is_example=False).count(), 1)
        job2.refresh_from_db()
        self.assertGreaterEqual(job2.stats_json.get('skipped', 0), 1)

    def test_packative_disabled_blocks_execute(self):
        policy = json.loads(disabled_packative_policy_path().read_text(encoding='utf-8'))
        plan = AcquisitionPlan.objects.create(
            organization=self.org,
            adapter_type=AcquisitionPlan.AdapterType.AUTHORIZED_BROWSER,
            enabled=False,
            status=AcquisitionPlan.Status.READY,
            title='packative-disabled',
            policy_json=policy,
            spec_plan_json=[{'l': 100, 'w': 80, 'h': 50}],
        )
        validation = validate_plan(plan, owner=self.user)
        self.assertFalse(validation.ok)
        self.assertIn('SOURCE_DISABLED', validation.block_codes)

        dry = dry_run_plan(plan, owner=self.user)
        self.assertTrue(dry.blocked)
        self.assertIn('SOURCE_DISABLED', dry.block_codes)

        job = create_job(plan=plan, owner=self.user, dry_run=False)
        result = process_job(str(job.id))
        self.assertEqual(result['status'], AcquisitionJob.Status.FAILED)
        self.assertEqual(result['error_code'], 'SOURCE_DISABLED')
        self.assertEqual(AssetVariant.objects.filter(is_example=False).count(), 0)
        job.refresh_from_db()
        blocked = job.items.filter(status='blocked').first()
        self.assertIsNotNone(blocked)
        self.assertEqual(blocked.failure_code, 'SOURCE_DISABLED')

    def test_packative_default_enabled_perpetual_gate_open(self):
        policy = json.loads(default_packative_policy_path().read_text(encoding='utf-8'))
        self.assertTrue(policy.get('enabled'))
        self.assertTrue((policy.get('grant') or {}).get('perpetual'))
        plan = AcquisitionPlan.objects.create(
            organization=self.org,
            adapter_type=AcquisitionPlan.AdapterType.AUTHORIZED_BROWSER,
            enabled=True,
            status=AcquisitionPlan.Status.READY,
            title='packative-default',
            policy_json=policy,
            spec_plan_json=[{'l': 100, 'w': 80, 'h': 50}],
        )
        validation = validate_plan(plan, owner=self.user)
        self.assertTrue(validation.ok)
        dry = dry_run_plan(plan, owner=self.user)
        self.assertFalse(dry.blocked)
        self.assertGreater(dry.planned_count, 0)
        job = create_job(plan=plan, owner=self.user, dry_run=False)
        result = process_job(str(job.id))
        # Runtime exists; without --live / execution.live, execute refuses network.
        self.assertEqual(result['status'], AcquisitionJob.Status.FAILED)
        self.assertEqual(result['error_code'], 'LIVE_FLAG_REQUIRED')
        self.assertEqual(AssetVariant.objects.filter(is_example=False).count(), 0)

    def test_celery_eager_consumes_job(self):
        plan = self._local_plan()
        job = create_job(plan=plan, owner=self.user, dry_run=False)
        with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
            out = dispatch_acquisition_job.delay(str(job.id))
            payload = out.get()
        self.assertEqual(payload['status'], AcquisitionJob.Status.SUCCEEDED)
        job.refresh_from_db()
        self.assertEqual(job.status, AcquisitionJob.Status.SUCCEEDED)
        self.assertGreaterEqual(job.items.count(), 1)

    def test_api_validate_and_job_sync(self):
        token = self._login()
        policy = json.loads(default_packative_policy_path().read_text(encoding='utf-8'))
        r = self.client.post(
            '/api/v1/dieline-library/acquisition-plans/validate/',
            data=json.dumps(
                {
                    'adapter_type': 'authorized_browser',
                    'enabled': False,
                    'policy_json': policy,
                    'spec_plan_json': [{'l': 1}],
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 200)
        body = r.json()['data']
        self.assertTrue(body['dry_run']['blocked'])

        plan = self._local_plan()
        token = self._csrf()
        r2 = self.client.post(
            '/api/v1/dieline-library/acquisition-jobs/',
            data=json.dumps({'plan_id': str(plan.id), 'dry_run': True, 'sync': True}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r2.status_code, 200)
        job_body = r2.json()['data']
        self.assertEqual(job_body['status'], AcquisitionJob.Status.SUCCEEDED)

    def test_unauthenticated_variants_rejected(self):
        r = self.client.get('/api/v1/dieline-library/variants/')
        self.assertIn(r.status_code, (401, 403))

    def test_supplier_zip_path_traversal_rejected(self):
        zip_path = Path(self._tmpdir.name) / 'evil.zip'
        with zipfile.ZipFile(zip_path, 'w') as zf:
            zf.writestr('../escape.svg', SAFE_SVG)
            zf.writestr('manifest.json', json.dumps({'assets': []}))
        plan = AcquisitionPlan(
            organization=self.org,
            adapter_type=AcquisitionPlan.AdapterType.SUPPLIER_PACKAGE,
            enabled=True,
            policy_json={'package_path': str(zip_path)},
        )
        plan._owner = self.user
        report = SupplierPackageAdapter().dry_run(plan)
        self.assertTrue(report.blocked)
        self.assertIn('ZIP_PATH_TRAVERSAL', report.block_codes)
