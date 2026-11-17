from __future__ import annotations

from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.console.audit import write_audit
from apps.console.pagination import paginate_queryset
from apps.console.permissions import IsStaffUser
from apps.content.markdown import render_markdown
from apps.content.models import BlogPost
from apps.content.services import (
    ContentError,
    create_post,
    delete_post,
    patch_post,
    publish_post,
    serialize_post,
    unpublish_post,
)
from config.api import fail, ok

STAFF = [IsAuthenticated, IsStaffUser]


def _err(request, exc: ContentError):
    return fail(str(exc), code=exc.code, errors=exc.errors, request=request, http_status=exc.status)


class BlogPostListCreateView(APIView):
    permission_classes = STAFF

    def get(self, request):
        qs = BlogPost.objects.prefetch_related('translations').order_by('-updated_at')
        status = (request.query_params.get('status') or '').strip()
        if status in BlogPost.Status.values:
            qs = qs.filter(status=status)
        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(slug__icontains=q)
                | Q(translations__title__icontains=q)
                | Q(translations__excerpt__icontains=q)
            ).distinct()
        items, page = paginate_queryset(qs, request)
        data = [serialize_post(p, include_body=False) for p in items]
        return ok({'items': data, 'page': page}, request=request)

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        try:
            post = create_post(user=request.user, body=body)
        except ContentError as exc:
            return _err(request, exc)
        write_audit(
            request=request,
            action='blog.post.create',
            target_type='blog_post',
            target_id=str(post.id),
            meta={'slug': post.slug},
        )
        return ok(serialize_post(post, include_body=True), message='created', request=request, http_status=201)


class BlogPostDetailView(APIView):
    permission_classes = STAFF

    def _get(self, post_id):
        return BlogPost.objects.prefetch_related('translations').filter(pk=post_id).first()

    def get(self, request, post_id):
        post = self._get(post_id)
        if not post:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        return ok(serialize_post(post, include_body=True), request=request)

    def patch(self, request, post_id):
        post = self._get(post_id)
        if not post:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        body = request.data if isinstance(request.data, dict) else {}
        try:
            post = patch_post(post=post, body=body)
        except ContentError as exc:
            return _err(request, exc)
        write_audit(
            request=request,
            action='blog.post.patch',
            target_type='blog_post',
            target_id=str(post.id),
            meta={'slug': post.slug},
        )
        return ok(serialize_post(post, include_body=True), request=request)

    def delete(self, request, post_id):
        post = self._get(post_id)
        if not post:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        try:
            delete_post(post)
        except ContentError as exc:
            return _err(request, exc)
        write_audit(
            request=request,
            action='blog.post.delete',
            target_type='blog_post',
            target_id=str(post_id),
        )
        return ok({}, message='deleted', request=request)


class BlogPostPublishView(APIView):
    permission_classes = STAFF

    def post(self, request, post_id):
        post = BlogPost.objects.prefetch_related('translations').filter(pk=post_id).first()
        if not post:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        try:
            post = publish_post(post)
        except ContentError as exc:
            return _err(request, exc)
        write_audit(
            request=request,
            action='blog.post.publish',
            target_type='blog_post',
            target_id=str(post.id),
            meta={'slug': post.slug},
        )
        return ok(serialize_post(post, include_body=True), message='published', request=request)


class BlogPostUnpublishView(APIView):
    permission_classes = STAFF

    def post(self, request, post_id):
        post = BlogPost.objects.prefetch_related('translations').filter(pk=post_id).first()
        if not post:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        post = unpublish_post(post)
        write_audit(
            request=request,
            action='blog.post.unpublish',
            target_type='blog_post',
            target_id=str(post.id),
            meta={'slug': post.slug},
        )
        return ok(serialize_post(post, include_body=True), message='unpublished', request=request)


class BlogPostPreviewView(APIView):
    permission_classes = STAFF

    def get(self, request, post_id):
        post = BlogPost.objects.prefetch_related('translations').filter(pk=post_id).first()
        if not post:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        locale = (request.query_params.get('locale') or 'zh-CN').strip()
        tr = post.translations.filter(locale=locale).first()
        if not tr:
            return fail('translation missing', code='NOT_FOUND', request=request, http_status=404)
        html = tr.body_html_cache or render_markdown(tr.body_markdown)
        return ok(
            {
                'locale': locale,
                'title': tr.title,
                'excerpt': tr.excerpt,
                'body_html': html,
            },
            request=request,
        )
