from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError
from io import BytesIO

from django.test import TestCase, override_settings

from apps.accounts.models import User
from apps.dieline_library.models import AcquisitionItem, AcquisitionJob, AcquisitionPlan, AssetVariant
from apps.dieline_library.services.adapters.packative_runtime import planned_targets
from apps.dieline_library.services.adapters.policy import (
    default_packative_policy_path,
    disabled_packative_policy_path,
)
from apps.dieline_library.services.adapters.runner import create_job, dry_run_plan, process_job, validate_plan
from apps.organizations.services import ensure_personal_org

VALID_SVG = b"""<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path ev-style="Cutting" d="M0 0 L10 0"/>
  <path ev-style="Creasing" d="M0 5 L10 5"/>
</svg>
"""

ACCESS_DENIED_XML = b"""<?xml version="1.0"?>
<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>
"""


class _FakeHTTPResponse:
    def __init__(self, body: bytes, status: int = 200):
        self._body = body
        self.status = status

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class PackativeRuntimeTests(TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        media_override = override_settings(MEDIA_ROOT=Path(self._tmpdir.name) / 'media')
        media_override.enable()
        self.addCleanup(media_override.disable)

        self.user = User.objects.create_user(email='packruntime@example.com', password='Password123!')
        self.org = ensure_personal_org(self.user)

    def _policy(self, **overrides):
        policy = json.loads(default_packative_policy_path().read_text(encoding='utf-8'))
        # Limit to one target for fast tests
        policy['dimension_plan'] = [{'L': 90, 'W': 80, 'H': 80, 'reason': 'test'}]
        execution = dict(policy.get('execution') or {})
        execution['live'] = True
        execution['require_live_flag'] = True
        execution['crawl_backend'] = 'direct'
        execution['min_seconds_between_jobs'] = 0
        policy['execution'] = execution
        policy.update(overrides)
        return policy

    def _plan(self, policy=None, adapter=AcquisitionPlan.AdapterType.AUTHORIZED_API):
        policy = policy or self._policy()
        return AcquisitionPlan.objects.create(
            organization=self.org,
            adapter_type=adapter,
            enabled=True,
            status=AcquisitionPlan.Status.READY,
            title='packative-runtime',
            policy_json=policy,
            spec_plan_json=policy.get('dimension_plan') or [],
            budget_json=policy.get('execution') or {},
        )

    def test_dry_run_planned_count_no_network(self):
        plan = self._plan()
        with mock.patch('urllib.request.urlopen') as urlopen:
            report = dry_run_plan(plan, owner=self.user)
            urlopen.assert_not_called()
        self.assertFalse(report.blocked)
        self.assertEqual(report.planned_count, 1)
        self.assertTrue(report.items)
        self.assertIn('studio-cdn.packative.com', report.items[0]['url'])

    def test_execute_mock_valid_svg_creates_inventory(self):
        plan = self._plan()
        before = AssetVariant.objects.filter(organization=self.org, is_example=False).count()

        def fake_urlopen(req, timeout=30):
            return _FakeHTTPResponse(VALID_SVG, 200)

        job = create_job(plan=plan, owner=self.user, dry_run=False)
        with mock.patch('urllib.request.urlopen', side_effect=fake_urlopen):
            result = process_job(str(job.id))
        self.assertEqual(result['status'], AcquisitionJob.Status.SUCCEEDED)
        self.assertGreaterEqual(result['stats'].get('succeeded', 0), 1)
        after = AssetVariant.objects.filter(organization=self.org, is_example=False).count()
        self.assertGreater(after, before)
        job.refresh_from_db()
        item = job.items.filter(status=AcquisitionItem.Status.SUCCEEDED).first()
        self.assertIsNotNone(item)
        self.assertIsNotNone(item.revision_id)

    def test_execute_access_denied_no_inventory(self):
        plan = self._plan()
        before = AssetVariant.objects.filter(organization=self.org, is_example=False).count()

        def fake_urlopen(req, timeout=30):
            raise HTTPError(
                url=req.full_url if hasattr(req, 'full_url') else 'https://studio-cdn.packative.com/x',
                code=403,
                msg='Forbidden',
                hdrs=None,
                fp=BytesIO(ACCESS_DENIED_XML),
            )

        job = create_job(plan=plan, owner=self.user, dry_run=False)
        with mock.patch('urllib.request.urlopen', side_effect=fake_urlopen):
            result = process_job(str(job.id))
        self.assertEqual(result['status'], AcquisitionJob.Status.FAILED)
        after = AssetVariant.objects.filter(organization=self.org, is_example=False).count()
        self.assertEqual(after, before)
        job.refresh_from_db()
        failed = job.items.filter(status=AcquisitionItem.Status.FAILED).first()
        self.assertIsNotNone(failed)
        self.assertIn(failed.failure_code, {'http_403', 'access_denied', 'ACCESS_DENIED'})

    def test_ssrf_non_whitelist_host_rejected(self):
        policy = self._policy()
        policy['dimension_plan'] = [{'L': 90, 'W': 80, 'H': 80}]
        # Force a malicious template via contract override file
        bad_contract = {
            'schema_version': '1.0',
            'source_id': 'packative',
            'product': 'productbox-crashlock',
            'tenant': 'ee4e06e4-c9b7-410f-b600-175fb1212729',
            'cdn_template': 'https://evil.example/{tenant}/dielines/{product}/{L}_{W}_{H}/dieline.svg',
            'family_name': 'Crashlock',
            'category': 'shipping',
            'targets': policy['dimension_plan'],
        }
        contract_path = Path(self._tmpdir.name) / 'bad_contract.json'
        contract_path.write_text(json.dumps(bad_contract), encoding='utf-8')
        policy['contract_path'] = str(contract_path)
        plan = self._plan(policy=policy)

        job = create_job(plan=plan, owner=self.user, dry_run=False)
        with mock.patch('urllib.request.urlopen') as urlopen:
            result = process_job(str(job.id))
            urlopen.assert_not_called()
        self.assertEqual(result['status'], AcquisitionJob.Status.FAILED)
        self.assertEqual(result['error_code'], 'SSRF_HOST_BLOCKED')
        self.assertEqual(AssetVariant.objects.filter(organization=self.org, is_example=False).count(), 0)

    def test_disabled_policy_still_source_disabled(self):
        policy = json.loads(disabled_packative_policy_path().read_text(encoding='utf-8'))
        plan = AcquisitionPlan.objects.create(
            organization=self.org,
            adapter_type=AcquisitionPlan.AdapterType.AUTHORIZED_API,
            enabled=False,
            status=AcquisitionPlan.Status.READY,
            title='disabled',
            policy_json=policy,
            spec_plan_json=[],
        )
        validation = validate_plan(plan, owner=self.user)
        self.assertIn('SOURCE_DISABLED', validation.block_codes)
        job = create_job(plan=plan, owner=self.user, dry_run=False)
        result = process_job(str(job.id))
        self.assertEqual(result['error_code'], 'SOURCE_DISABLED')
        self.assertEqual(AssetVariant.objects.filter(organization=self.org, is_example=False).count(), 0)

    def test_live_flag_required_without_live(self):
        policy = self._policy()
        policy['execution']['live'] = False
        plan = self._plan(policy=policy)
        job = create_job(plan=plan, owner=self.user, dry_run=False)
        with mock.patch('urllib.request.urlopen') as urlopen:
            result = process_job(str(job.id))
            urlopen.assert_not_called()
        self.assertEqual(result['error_code'], 'LIVE_FLAG_REQUIRED')

    def test_planned_targets_respect_max_jobs(self):
        policy = self._policy()
        policy['dimension_plan'] = [
            {'L': 90, 'W': 80, 'H': 80},
            {'L': 110, 'W': 80, 'H': 80},
            {'L': 100, 'W': 70, 'H': 80},
        ]
        policy['execution']['max_jobs'] = 2
        targets = planned_targets(policy)
        self.assertEqual(len(targets), 2)
