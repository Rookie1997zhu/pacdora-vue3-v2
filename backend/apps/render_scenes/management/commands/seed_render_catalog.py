from django.core.management.base import BaseCommand

from apps.render_scenes.catalog import seed_render_catalog


class Command(BaseCommand):
    help = 'Seed official render props, HDR environments, and scene templates'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Recreate seeded assets')

    def handle(self, *args, **options):
        created = seed_render_catalog(force=bool(options.get('force')))
        self.stdout.write(self.style.SUCCESS(f'seed_render_catalog: {created}'))
