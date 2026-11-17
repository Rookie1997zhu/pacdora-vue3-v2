from __future__ import annotations

from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.console.pagination import paginate_queryset
from apps.content.locale import normalize_locale, resolve_locale
from apps.content.models import BlogPost
from apps.content.services import serialize_public_card, serialize_public_detail
from config.api import fail, ok


def _published_qs():
    return (
        BlogPost.objects.filter(status=BlogPost.Status.PUBLISHED)
        .select_related('author')
        .prefetch_related('translations')
    )


def _request_locale(request) -> str:
    raw = (request.query_params.get('locale') or '').strip()
    override = normalize_locale(raw)
    if override:
        return override
    return resolve_locale(request)['locale']


def _collect_all_tags() -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for tags in _published_qs().values_list('tags', flat=True):
        for tag in tags or []:
            key = str(tag).strip()
            if not key or key in seen:
                continue
            seen.add(key)
            ordered.append(key)
    return sorted(ordered)


def _related_cards(post: BlogPost, locale: str, *, limit: int = 3) -> list[dict]:
    related: list[dict] = []
    tags = list(post.tags or [])
    qs = _published_qs().exclude(pk=post.pk).order_by('-published_at', '-updated_at')
    if tags:
        tag_q = Q()
        for t in tags:
            tag_q |= Q(tags__contains=[t])
        tagged = list(qs.filter(tag_q)[:6])
        for cand in tagged:
            card = serialize_public_card(cand, locale)
            if card:
                related.append(card)
            if len(related) >= limit:
                return related
    if len(related) < limit:
        seen = {c['slug'] for c in related}
        for cand in qs[:8]:
            if cand.slug in seen:
                continue
            card = serialize_public_card(cand, locale)
            if card:
                related.append(card)
                seen.add(cand.slug)
            if len(related) >= limit:
                break
    return related


class PublicBlogPostListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        locale = _request_locale(request)
        tag = (request.query_params.get('tag') or '').strip()
        q = (request.query_params.get('q') or '').strip()
        qs = _published_qs().order_by('-published_at', '-updated_at')
        if tag:
            qs = qs.filter(tags__contains=[tag])
        if q:
            qs = qs.filter(
                Q(slug__icontains=q)
                | Q(translations__title__icontains=q)
                | Q(translations__excerpt__icontains=q)
            ).distinct()

        page_items, page = paginate_queryset(qs, request, default_size=12, max_size=50)
        cards: list[dict] = []
        for post in page_items:
            card = serialize_public_card(post, locale)
            if card:
                cards.append(card)

        featured: list[dict] = []
        items = cards
        if page['page'] == 1 and not tag and not q and cards:
            featured = cards[:1]
            items = cards[1:]

        return ok(
            {
                'featured': featured,
                'tags': _collect_all_tags(),
                'items': items,
                'page': page,
                'locale': locale,
            },
            request=request,
        )


class PublicBlogPostDetailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug: str):
        locale = _request_locale(request)
        post = _published_qs().filter(slug=slug).first()
        if not post:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        detail = serialize_public_detail(post, locale)
        if not detail:
            return fail('not found', code='NOT_FOUND', request=request, http_status=404)
        detail['related'] = _related_cards(post, locale, limit=3)
        return ok(detail, request=request)
