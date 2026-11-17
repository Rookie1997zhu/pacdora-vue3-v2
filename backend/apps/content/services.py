from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.content.markdown import render_markdown, sanitize_cover_url
from apps.content.models import BlogPost, BlogPostTranslation


class ContentError(Exception):
    def __init__(self, message, *, code='CONTENT_ERROR', status=400, errors=None, data=None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.errors = errors or {}
        self.data = data


def site_public_url() -> str:
    return (getattr(settings, 'SITE_PUBLIC_URL', '') or 'http://localhost').rstrip('/')


def absolute_url(path: str) -> str:
    if path.startswith('http://') or path.startswith('https://'):
        return path
    return f"{site_public_url()}{path if path.startswith('/') else '/' + path}"


def refresh_translation_html(tr: BlogPostTranslation) -> BlogPostTranslation:
    tr.body_html_cache = render_markdown(tr.body_markdown)
    tr.save(update_fields=['body_html_cache', 'updated_at'])
    return tr


def serialize_translation(tr: BlogPostTranslation, *, include_body: bool = True) -> dict:
    data = {
        'locale': tr.locale,
        'title': tr.title,
        'excerpt': tr.excerpt,
        'meta_description': tr.meta_description,
        'updated_at': tr.updated_at.isoformat(),
    }
    if include_body:
        data['body_markdown'] = tr.body_markdown
        data['body_html'] = tr.body_html_cache or render_markdown(tr.body_markdown)
    return data


def serialize_post(post: BlogPost, *, include_body: bool = False) -> dict:
    translations = {
        tr.locale: serialize_translation(tr, include_body=include_body)
        for tr in post.translations.all()
    }
    return {
        'id': str(post.id),
        'slug': post.slug,
        'status': post.status,
        'published_at': post.published_at.isoformat() if post.published_at else None,
        'cover_url': post.cover_url,
        'tags': post.tags or [],
        'author_id': str(post.author_id) if post.author_id else None,
        'created_at': post.created_at.isoformat(),
        'updated_at': post.updated_at.isoformat(),
        'translations': translations,
    }


def _upsert_translations(post: BlogPost, translations: dict | None):
    if not isinstance(translations, dict):
        return
    for locale, payload in translations.items():
        if locale not in BlogPostTranslation.Locale.values:
            raise ContentError('invalid locale', code='VALIDATION_ERROR', status=400)
        if not isinstance(payload, dict):
            raise ContentError('invalid translation payload', code='VALIDATION_ERROR', status=400)
        tr, _created = BlogPostTranslation.objects.get_or_create(
            post=post,
            locale=locale,
            defaults={
                'title': str(payload.get('title') or '')[:240],
                'excerpt': str(payload.get('excerpt') or ''),
                'body_markdown': str(payload.get('body_markdown') or ''),
                'meta_description': str(payload.get('meta_description') or '')[:320],
            },
        )
        if not _created:
            if 'title' in payload:
                tr.title = str(payload.get('title') or '')[:240]
            if 'excerpt' in payload:
                tr.excerpt = str(payload.get('excerpt') or '')
            if 'body_markdown' in payload:
                tr.body_markdown = str(payload.get('body_markdown') or '')
            if 'meta_description' in payload:
                tr.meta_description = str(payload.get('meta_description') or '')[:320]
        refresh_translation_html(tr)


def _valid_slug(value: str) -> str:
    raw = (value or '').strip().lower()
    cleaned = slugify(raw) or raw
    cleaned = cleaned.strip('-')[:160]
    if not cleaned:
        raise ContentError('invalid slug', code='VALIDATION_ERROR', status=400)
    return cleaned


@transaction.atomic
def create_post(*, user, body: dict) -> BlogPost:
    slug = _valid_slug(str(body.get('slug') or ''))
    if BlogPost.objects.filter(slug=slug).exists():
        raise ContentError('slug already exists', code='CONFLICT', status=409)
    cover = sanitize_cover_url(str(body.get('cover_url') or ''))
    tags = body.get('tags') if isinstance(body.get('tags'), list) else []
    tags = [str(t).strip()[:40] for t in tags if str(t).strip()][:20]
    post = BlogPost.objects.create(
        slug=slug,
        cover_url=cover,
        tags=tags,
        author=user if user and getattr(user, 'pk', None) else None,
        status=BlogPost.Status.DRAFT,
    )
    _upsert_translations(post, body.get('translations'))
    return BlogPost.objects.prefetch_related('translations').get(pk=post.pk)


@transaction.atomic
def patch_post(*, post: BlogPost, body: dict) -> BlogPost:
    fields = []
    if 'slug' in body:
        slug = _valid_slug(str(body.get('slug') or ''))
        if BlogPost.objects.filter(slug=slug).exclude(pk=post.pk).exists():
            raise ContentError('slug already exists', code='CONFLICT', status=409)
        post.slug = slug
        fields.append('slug')
    if 'cover_url' in body:
        post.cover_url = sanitize_cover_url(str(body.get('cover_url') or ''))
        fields.append('cover_url')
    if 'tags' in body:
        tags = body.get('tags') if isinstance(body.get('tags'), list) else []
        post.tags = [str(t).strip()[:40] for t in tags if str(t).strip()][:20]
        fields.append('tags')
    if fields:
        fields.append('updated_at')
        post.save(update_fields=fields)
    if 'translations' in body:
        _upsert_translations(post, body.get('translations'))
    return BlogPost.objects.prefetch_related('translations').get(pk=post.pk)


def _has_publishable_translation(post: BlogPost) -> bool:
    for tr in post.translations.all():
        if (tr.title or '').strip() and (tr.body_markdown or '').strip():
            return True
    return False


@transaction.atomic
def publish_post(post: BlogPost) -> BlogPost:
    post = BlogPost.objects.prefetch_related('translations').select_for_update().get(pk=post.pk)
    if not _has_publishable_translation(post):
        raise ContentError(
            'at least one locale needs title and body',
            code='VALIDATION_ERROR',
            status=400,
        )
    post.status = BlogPost.Status.PUBLISHED
    if not post.published_at:
        post.published_at = timezone.now()
    post.save(update_fields=['status', 'published_at', 'updated_at'])
    return post


@transaction.atomic
def unpublish_post(post: BlogPost) -> BlogPost:
    post.status = BlogPost.Status.DRAFT
    post.save(update_fields=['status', 'updated_at'])
    return post


def delete_post(post: BlogPost) -> None:
    if post.status == BlogPost.Status.PUBLISHED:
        raise ContentError('published posts cannot be deleted; unpublish first', code='CONFLICT', status=409)
    post.delete()


def pick_translation(post: BlogPost, locale: str) -> tuple[BlogPostTranslation | None, str]:
    by_locale = {tr.locale: tr for tr in post.translations.all()}
    if locale in by_locale and (by_locale[locale].title or '').strip():
        return by_locale[locale], locale
    for fallback in ('ko-KR', 'zh-CN'):
        tr = by_locale.get(fallback)
        if tr and (tr.title or '').strip():
            return tr, fallback
    return None, locale


def _author_name(post: BlogPost) -> str:
    author = getattr(post, 'author', None)
    if not author:
        return ''
    name = (getattr(author, 'display_name', None) or '').strip()
    if name:
        return name
    email = (getattr(author, 'email', None) or '').strip()
    return email.split('@')[0] if email else ''


def serialize_public_card(post: BlogPost, locale: str) -> dict | None:
    tr, used = pick_translation(post, locale)
    if not tr:
        return None
    meta_desc = (tr.meta_description or tr.excerpt or tr.title or '')[:320]
    return {
        'slug': post.slug,
        'title': tr.title,
        'summary': tr.excerpt or '',
        'cover_url': post.cover_url or '',
        'tags': list(post.tags or []),
        'author_name': _author_name(post),
        'published_at': post.published_at.isoformat() if post.published_at else None,
        'meta_title': tr.title,
        'meta_description': meta_desc,
        'locale': used,
        'fallback': used != locale,
    }


def serialize_public_detail(post: BlogPost, locale: str) -> dict | None:
    card = serialize_public_card(post, locale)
    if not card:
        return None
    tr, _used = pick_translation(post, locale)
    if not tr:
        return None
    body_html = tr.body_html_cache or render_markdown(tr.body_markdown)
    card['body_html'] = body_html
    return card
