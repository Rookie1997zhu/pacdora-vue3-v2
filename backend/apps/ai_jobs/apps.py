from django.apps import AppConfig


class AiJobsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.ai_jobs'
    label = 'ai_jobs'

    def ready(self):
        # Ensure Celery autodiscover finds tasks
        from . import tasks  # noqa: F401
