from __future__ import annotations

import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.dieline_library.models import AcquisitionJob, AcquisitionPlan
from apps.dieline_library.services.adapters.policy import default_packative_policy_path, load_policy_dict
from apps.dieline_library.services.adapters.runner import create_job, dry_run_plan, process_job, validate_plan
from apps.organizations.models import Membership, Organization


class Command(BaseCommand):
    help = 'Validate/dry-run/execute/resume dieline acquisition via SourceAdapter.'

    def add_arguments(self, parser):
        parser.add_argument('--org', required=True, help='Organization UUID')
        parser.add_argument(
            '--adapter',
            default='local_manifest',
            choices=[c.value for c in AcquisitionPlan.AdapterType],
        )
        parser.add_argument('--policy', default='', help='Path to source policy JSON')
        parser.add_argument('--manifest', default='', help='local_manifest path')
        parser.add_argument('--files-root', default='', help='files root for local_manifest')
        parser.add_argument('--package', default='', help='supplier package dir or zip')
        parser.add_argument('--owner', default='', help='Owner user email')
        parser.add_argument('--plan-id', default='', help='Existing AcquisitionPlan UUID')
        parser.add_argument('--resume-job', default='', help='Resume AcquisitionJob UUID')
        parser.add_argument('--dry-run', action='store_true', help='Dry-run only (default if no --execute)')
        parser.add_argument('--execute', action='store_true', help='Create job and process synchronously')
        parser.add_argument(
            '--live',
            action='store_true',
            help='Allow real network for authorized_api/browser (sets execution.live=true)',
        )
        parser.add_argument('--title', default='', help='Plan title')

    def handle(self, *args, **options):
        org = Organization.objects.filter(id=options['org']).first()
        if not org:
            raise CommandError('organization not found')
        User = get_user_model()
        owner = None
        if options['owner']:
            owner = User.objects.filter(email=options['owner']).first()
            if not owner:
                raise CommandError('owner user not found')
        else:
            m = (
                Membership.objects.filter(organization=org, is_active=True, role=Membership.Role.OWNER)
                .select_related('user')
                .first()
                or Membership.objects.filter(organization=org, is_active=True).select_related('user').first()
            )
            owner = m.user if m else None
            if not owner:
                raise CommandError('no owner user available')

        if options['resume_job']:
            job = AcquisitionJob.objects.filter(id=options['resume_job'], organization=org).first()
            if not job:
                raise CommandError('job not found')
            result = process_job(str(job.id))
            self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if options['plan_id']:
            plan = AcquisitionPlan.objects.filter(id=options['plan_id'], organization=org).first()
            if not plan:
                raise CommandError('plan not found')
        else:
            adapter = options['adapter']
            policy: dict = {}
            if options['policy']:
                policy = json.loads(Path(options['policy']).read_text(encoding='utf-8'))
            elif adapter in (
                AcquisitionPlan.AdapterType.AUTHORIZED_BROWSER,
                AcquisitionPlan.AdapterType.AUTHORIZED_API,
            ):
                policy = json.loads(default_packative_policy_path().read_text(encoding='utf-8'))
                policy['adapter_type'] = adapter

            if options['manifest']:
                policy['manifest_path'] = str(Path(options['manifest']).resolve())
            if options['files_root']:
                policy['files_root'] = str(Path(options['files_root']).resolve())
            if options['package']:
                policy['package_path'] = str(Path(options['package']).resolve())

            if options['live']:
                execution = dict(policy.get('execution') or {})
                execution['live'] = True
                policy['execution'] = execution

            enabled = bool(load_policy_dict(policy).get('enabled', True))
            plan = AcquisitionPlan.objects.create(
                organization=org,
                adapter_type=adapter,
                enabled=enabled,
                status=AcquisitionPlan.Status.READY,
                policy_json=policy,
                spec_plan_json=policy.get('dimension_plan') or [],
                budget_json=policy.get('execution') or {},
                title=options['title'] or f'{adapter} plan',
            )
        elif options['live']:
            # Existing plan: stamp live onto policy for this run.
            policy = dict(plan.policy_json or {})
            execution = dict(policy.get('execution') or {})
            execution['live'] = True
            policy['execution'] = execution
            plan.policy_json = policy
            plan.budget_json = execution
            plan.save(update_fields=['policy_json', 'budget_json', 'updated_at'])

        validation = validate_plan(plan, owner=owner)
        dry = dry_run_plan(plan, owner=owner)
        payload = {
            'plan_id': str(plan.id),
            'validation': validation.to_dict(),
            'dry_run': dry.to_dict(),
        }

        do_execute = bool(options['execute'])
        online = plan.adapter_type in (
            AcquisitionPlan.AdapterType.AUTHORIZED_API,
            AcquisitionPlan.AdapterType.AUTHORIZED_BROWSER,
        )
        if online and do_execute and not options['live']:
            # Without --live, online adapters stay dry-run only (no network).
            payload['notes'] = ['online execute requires --live; returned dry_run only']
            self.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2))
            return

        if not do_execute:
            self.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2))
            return

        job = create_job(plan=plan, owner=owner, dry_run=False)
        result = process_job(str(job.id))
        payload['job'] = result
        self.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2))
