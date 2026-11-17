from __future__ import annotations

from django.http import Http404, HttpResponse
from django.shortcuts import redirect
from django.views.decorators.http import require_GET

from apps.content.locale import path_to_locale
from apps.content.models import BlogPost
from apps.content.services import site_public_url


def _published_qs():
    return BlogPost.objects.filter(status=BlogPost.Status.PUBLISHED)


@require_GET
def blog_spa_redirect_root(request):
    return redirect('/blog', permanent=True)


@require_GET
def blog_spa_redirect_list(request, lang: str):
    if not path_to_locale(lang):
        raise Http404()
    return redirect('/blog', permanent=True)


@require_GET
def blog_spa_redirect_detail(request, lang: str, slug: str):
    if not path_to_locale(lang):
        raise Http404()
    return redirect(f'/blog/{slug}', permanent=True)


@require_GET
def robots_txt(request):
    base = site_public_url()
    body = (
        'User-agent: *\n'
        'Allow: /\n'
        'Disallow: /api/\n'
        'Disallow: /console\n'
        'Disallow: /console/\n'
        'Disallow: /account\n'
        'Disallow: /account/\n'
        'Disallow: /designs\n'
        'Disallow: /designs/\n'
        f'Sitemap: {base}/sitemap.xml\n'
    )
    return HttpResponse(body, content_type='text/plain; charset=utf-8')


@require_GET
def sitemap_xml(request):
    base = site_public_url()
    static_paths = ['/home', '/products', '/library/dielines', '/lab', '/blog']
    urls = []
    for path in static_paths:
        loc = f'{base}{path}'
        urls.append(_url_entry(loc, alternates=None))

    for post in _published_qs().order_by('-updated_at'):
        loc = f'{base}/blog/{post.slug}'
        lastmod = (post.published_at or post.updated_at).date().isoformat()
        urls.append(
            _url_entry(
                loc,
                lastmod=lastmod,
                alternates=[
                    ('zh', loc),
                    ('ko', loc),
                    ('x-default', loc),
                ],
            )
        )

    xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        *urls,
        '</urlset>',
    ]
    return HttpResponse('\n'.join(xml), content_type='application/xml; charset=utf-8')


def _url_entry(loc: str, *, lastmod: str | None = None, alternates: list | None = None) -> str:
    parts = [f'  <url><loc>{_esc(loc)}</loc>']
    if lastmod:
        parts.append(f'<lastmod>{lastmod}</lastmod>')
    if alternates:
        for lang, href in alternates:
            parts.append(
                f'<xhtml:link rel="alternate" hreflang="{_esc(lang)}" href="{_esc(href)}" />'
            )
    parts.append('</url>')
    return ''.join(parts)


def _esc(value: str) -> str:
    return (
        value.replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
    )
