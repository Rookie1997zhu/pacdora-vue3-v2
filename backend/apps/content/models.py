from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class BlogPost(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=160, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    cover_url = models.URLField(max_length=500, blank=True)
    tags = models.JSONField(default=list, blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='blog_posts',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', '-published_at']),
            models.Index(fields=['-updated_at']),
        ]

    def __str__(self):
        return self.slug


class BlogPostTranslation(models.Model):
    class Locale(models.TextChoices):
        ZH_CN = 'zh-CN', 'Chinese'
        KO_KR = 'ko-KR', 'Korean'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE, related_name='translations')
    locale = models.CharField(max_length=10, choices=Locale.choices)
    title = models.CharField(max_length=240)
    excerpt = models.TextField(blank=True)
    body_markdown = models.TextField(blank=True)
    body_html_cache = models.TextField(blank=True)
    meta_description = models.CharField(max_length=320, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['post', 'locale'], name='uniq_blog_post_locale'),
        ]
        indexes = [models.Index(fields=['locale', 'title'])]

    def __str__(self):
        return f'{self.post_id}:{self.locale}'
