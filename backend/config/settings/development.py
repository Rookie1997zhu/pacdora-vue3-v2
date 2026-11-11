import os

from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ['*']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.environ.get('SQLITE_PATH', str(BASE_DIR / 'db.sqlite3')),  # noqa: F405
    }
}

CELERY_TASK_ALWAYS_EAGER = True
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Vite dev origins (CSRF Origin check)
CSRF_TRUSTED_ORIGINS = list(
    {
        *CSRF_TRUSTED_ORIGINS,  # noqa: F405
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
    }
)
CORS_ALLOWED_ORIGINS = list(
    {
        *CORS_ALLOWED_ORIGINS,  # noqa: F405
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    }
)
