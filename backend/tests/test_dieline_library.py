import json
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from apps.accounts.models import User
from apps.dieline_library.models import AssetVariant, ImmutableRevision, UsageGrant
from apps.dieline_library.services.import_manifest import import_local_manifest
from apps.organizations.services import ensure_personal_org

SAFE_SVG = b"""<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>
"""
SCRIPT_SVG = b"""<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>
"""
HTML_FAKE = b"""<!DOCTYPE html><html><body>login</body></html>"""


class DielineLibraryTests(TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        media_override = override_settings(MEDIA_ROOT=Path(self._tmpdir.name) / 'media')
        media_override.enable()
        self.addCleanup(media_override.disable)

        self.files_root = Path(self._tmpdir.name) / 'files'
        self.files_root.mkdir(parents=True)
        (self.files_root / 'ok.svg').write_bytes(SAFE_SVG)
        (self.files_root / 'bad.svg').write_bytes(SCRIPT_SVG)
        (self.files_root / 'login.svg').write_bytes(HTML_FAKE)

        self.client = Client(enforce_csrf_checks=True)
        self.u1 = User.objects.create_user(email='dl1@example.com', password='Password123!')
        self.u2 = User.objects.create_user(email='dl2@example.com', password='Password123!')
        self.org1 = ensure_personal_org(self.u1)
        self.org2 = ensure_personal_org(self.u2)

    def _csrf(self):
        self.client.get('/api/v1/auth/csrf/')
        return self.client.cookies.get('csrftoken').value

    def _login(self, email='dl1@example.com'):
        token = self._csrf()
        r = self.client.post(
            '/api/v1/auth/login/',
            data=json.dumps({'email': email, 'password': 'Password123!'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 200)
        return self._csrf()

    def _manifest(self, *, path='ok.svg', is_example=False, published='published', redistribute=True, internal=True, dims=None):
        dims = dims or {'length_mm': 100, 'width_mm': 80, 'height_mm': 50, 'basis': 'unknown'}
        return {
            'is_example': is_example,
            'provider': 'local_manifest',
            'assets': [
                {
                    'is_example': is_example,
                    'title': {'zh': 'Test Box'},
                    'family_name': 'Test Family',
                    'source_template_id': 't1',
                    'template_revision': '1',
                    'dimensions': dims,
                    'files': [{'path': path, 'mime': 'image/svg+xml'}],
                    'rights': {
                        'grant_status': 'granted',
                        'permissions': {
                            'can_store': True,
                            'can_use_internally': internal,
                            'can_redistribute_files': redistribute,
                            'can_show_public_preview': True,
                        },
                    },
                    'quality': {
                        'publication_status': published,
                        'manufacturing_status': 'reference_only',
                    },
                }
            ],
        }

    def _write_manifest(self, data: dict) -> Path:
        p = self.files_root / 'manifest.json'
        p.write_text(json.dumps(data), encoding='utf-8')
        return p

    def test_dry_run_does_not_write(self):
        manifest = self._write_manifest(self._manifest())
        report = import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=True,
        )
        self.assertTrue(report.dry_run)
        self.assertEqual(AssetVariant.objects.count(), 0)
        self.assertEqual(ImmutableRevision.objects.count(), 0)

    def test_execute_idempotent(self):
        manifest = self._write_manifest(self._manifest(is_example=False, redistribute=True))
        r1 = import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        r2 = import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        self.assertEqual(r1.created_revisions, 1)
        self.assertEqual(r2.skipped, 1)
        self.assertEqual(ImmutableRevision.objects.count(), 1)

    def test_example_excluded_from_default_list_and_inventory(self):
        manifest = self._write_manifest(self._manifest(is_example=True, redistribute=True))
        import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        self._login()
        r = self.client.get('/api/v1/dieline-library/variants/')
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body['data']['inventory_count'], 0)
        self.assertEqual(body['data']['items'], [])

    def test_cross_org_download_forbidden(self):
        manifest = self._write_manifest(self._manifest(is_example=False, redistribute=True))
        import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        rev = ImmutableRevision.objects.get()
        self._login('dl2@example.com')
        r = self.client.get(f'/api/v1/dieline-library/revisions/{rev.id}/download/')
        self.assertEqual(r.status_code, 403)

    def test_download_denied_without_rights(self):
        manifest = self._write_manifest(
            self._manifest(is_example=False, redistribute=False, internal=False)
        )
        import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        rev = ImmutableRevision.objects.get()
        self._login()
        r = self.client.get(f'/api/v1/dieline-library/revisions/{rev.id}/download/')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json()['code'], 'DOWNLOAD_DENIED')

    def test_script_svg_needs_review_no_preview(self):
        manifest = self._write_manifest(self._manifest(path='bad.svg', is_example=False))
        import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        rev = ImmutableRevision.objects.get()
        self.assertEqual(rev.acquisition_status, ImmutableRevision.AcquisitionStatus.NEEDS_REVIEW)
        self.assertIsNone(rev.preview_asset_id)
        self._login()
        r = self.client.get(f'/api/v1/dieline-library/revisions/{rev.id}/preview/')
        self.assertEqual(r.status_code, 404)

    def test_unknown_dims_allowed(self):
        manifest = self._write_manifest(
            self._manifest(
                is_example=False,
                dims={'length_mm': None, 'width_mm': None, 'height_mm': None, 'basis': 'unknown'},
            )
        )
        import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        v = AssetVariant.objects.get()
        self.assertEqual(v.dimension_basis, AssetVariant.DimensionBasis.UNKNOWN)
        self.assertIsNone(v.length_mm)

    def test_download_ok_with_internal_grant(self):
        manifest = self._write_manifest(
            self._manifest(is_example=False, redistribute=False, internal=True)
        )
        import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        rev = ImmutableRevision.objects.get()
        self._login()
        r = self.client.get(f'/api/v1/dieline-library/revisions/{rev.id}/download/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.get('Content-Disposition', '').startswith('attachment'))
        # Consume/close streaming body so Windows can delete MEDIA_ROOT temp files.
        if getattr(r, 'streaming_content', None) is not None:
            b''.join(r.streaming_content)
        r.close()

    def test_list_filters_q_and_dims(self):
        manifest = self._write_manifest(self._manifest(is_example=False, redistribute=True))
        import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        self._login()
        hit = self.client.get('/api/v1/dieline-library/variants/', {'q': 'Test'})
        self.assertEqual(hit.status_code, 200)
        hit_body = hit.json()['data']
        self.assertEqual(len(hit_body['items']), 1)
        self.assertIn('svg', hit_body['items'][0]['formats'])
        self.assertEqual(hit_body['items'][0]['family_category'], 'general')

        miss = self.client.get('/api/v1/dieline-library/variants/', {'q': 'NoSuchTitle'})
        self.assertEqual(miss.json()['data']['items'], [])

        dim_hit = self.client.get(
            '/api/v1/dieline-library/variants/',
            {'min_l': '90', 'max_l': '110', 'file_format': 'svg'},
        )
        self.assertEqual(len(dim_hit.json()['data']['items']), 1)

        dim_miss = self.client.get('/api/v1/dieline-library/variants/', {'min_l': '200'})
        self.assertEqual(dim_miss.json()['data']['items'], [])

    def test_list_filters_status_and_category(self):
        data = self._manifest(is_example=False, redistribute=True)
        data['assets'][0]['category'] = 'tuck_end'
        manifest = self._write_manifest(data)
        import_local_manifest(
            organization=self.org1,
            owner=self.u1,
            manifest_path=manifest,
            files_root=self.files_root,
            dry_run=False,
        )
        self._login()
        cat_hit = self.client.get('/api/v1/dieline-library/variants/', {'category': 'tuck_end'})
        self.assertEqual(len(cat_hit.json()['data']['items']), 1)
        cat_miss = self.client.get('/api/v1/dieline-library/variants/', {'category': 'other'})
        self.assertEqual(cat_miss.json()['data']['items'], [])

        mfg = self.client.get(
            '/api/v1/dieline-library/variants/',
            {'manufacturing_status': 'reference_only'},
        )
        self.assertEqual(len(mfg.json()['data']['items']), 1)
        mfg_miss = self.client.get(
            '/api/v1/dieline-library/variants/',
            {'manufacturing_status': 'production_ok'},
        )
        self.assertEqual(mfg_miss.json()['data']['items'], [])
