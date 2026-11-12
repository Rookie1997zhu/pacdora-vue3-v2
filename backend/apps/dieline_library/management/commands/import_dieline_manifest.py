from __future__ import annotations

import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.dieline_library.services.import_manifest import ImportManifestError, import_local_manifest
from apps.organizations.models import Membership, Organization


class Command(BaseCommand):
    help = 'Import fixed dieline files from a local_manifest JSON (dry-run or execute).'

    def add_arguments(self, parser):
        parser.add_argument('--org', required=True, help='Organization UUID')
        parser.add_argument('--manifest', required=True, help='Path to manifest JSON')
        parser.add_argument('--files-root', required=True, help='Root directory for relative file paths')
        parser.add_argument('--owner', default='', help='Owner user email (default: org owner or first member)')
        parser.add_argument('--dry-run', action='store_true', help='Validate only; do not write')

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
            owner = m.user if m else User.objects.order_by('id').first()
            if not owner:
                raise CommandError('no owner user available')

        try:
            report = import_local_manifest(
                organization=org,
                owner=owner,
                manifest_path=Path(options['manifest']),
                files_root=Path(options['files_root']),
                dry_run=bool(options['dry_run']),
            )
        except ImportManifestError as exc:
            raise CommandError(f'{exc.code}: {exc}') from exc

        self.stdout.write(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
