import json

from django.test import Client, TestCase, override_settings

from apps.accounts.models import User
from apps.content.markdown import render_markdown
from apps.content.models import BlogPost, BlogPostTranslation
from apps.content.services import create_post, publish_post, refresh_translation_html


@override_settings(SITE_PUBLIC_URL='https://example.test')
class ContentSeoTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.staff = User.objects.create_user(
            email='editor@example.com',
            password='Password123!',
            is_staff=True,
        )
        self.user = User.objects.create_user(email='u@example.com', password='Password123!')

    def _csrf(self):
        r = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(r.status_code, 200)
        return r.json()['data']['csrf_token']

    def test_locale_hint_sources(self):
        r = self.client.get('/api/v1/site/locale-hint/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['data']['source'], 'default')

        r = self.client.get('/api/v1/site/locale-hint/', HTTP_ACCEPT_LANGUAGE='ko-KR,ko;q=0.9')
        self.assertEqual(r.json()['data']['locale'], 'ko-KR')
        self.assertEqual(r.json()['data']['source'], 'accept_language')

        r = self.client.get('/api/v1/site/locale-hint/', HTTP_CF_IPCOUNTRY='KR')
        self.assertEqual(r.json()['data']['locale'], 'ko-KR')
        self.assertEqual(r.json()['data']['source'], 'country')

        self.client.cookies['boxcraft_locale'] = 'zh-CN'
        r = self.client.get(
            '/api/v1/site/locale-hint/',
            HTTP_CF_IPCOUNTRY='KR',
            HTTP_ACCEPT_LANGUAGE='ko',
        )
        self.assertEqual(r.json()['data']['locale'], 'zh-CN')
        self.assertEqual(r.json()['data']['source'], 'cookie')

    def test_markdown_strips_script_and_javascript_links(self):
        html = render_markdown(
            'Hello <script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n[ok](https://example.com)\n\n[rel](/home)'
        )
        self.assertNotIn('<script', html.lower())
        self.assertNotIn('javascript:', html.lower())
        self.assertIn('https://example.com', html)
        self.assertIn('href="/home"', html)

    def test_draft_public_404_and_published_html(self):
        post = BlogPost.objects.create(slug='demo-post', status=BlogPost.Status.DRAFT)
        tr = BlogPostTranslation.objects.create(
            post=post,
            locale='ko-KR',
            title='데모',
            excerpt='요약',
            body_markdown='## Hi\n\n본문',
            meta_description='메타',
        )
        refresh_translation_html(tr)
        r = self.client.get('/blog/ko/demo-post/')
        self.assertEqual(r.status_code, 404)

        publish_post(post)
        r = self.client.get('/blog/ko/demo-post/')
        self.assertEqual(r.status_code, 200)
        body = r.content.decode('utf-8')
        self.assertIn('본문', body)
        self.assertIn('og:title', body)
        self.assertIn('hreflang="ko"', body)
        self.assertIn('hreflang="zh"', body)

    def test_sitemap_and_robots(self):
        post = create_post(
            user=self.staff,
            body={
                'slug': 'seed-a',
                'translations': {
                    'zh-CN': {'title': '中文', 'body_markdown': '正文'},
                    'ko-KR': {'title': '한국어', 'body_markdown': '본문'},
                },
            },
        )
        publish_post(post)
        draft = create_post(
            user=self.staff,
            body={
                'slug': 'draft-only',
                'translations': {'zh-CN': {'title': '草稿', 'body_markdown': 'x'}},
            },
        )
        self.assertEqual(draft.status, BlogPost.Status.DRAFT)

        sm = self.client.get('/sitemap.xml')
        self.assertEqual(sm.status_code, 200)
        text = sm.content.decode('utf-8')
        self.assertIn('/blog/ko/seed-a/', text)
        self.assertIn('/blog/zh/seed-a/', text)
        self.assertNotIn('draft-only', text)
        self.assertIn('hreflang', text)

        rb = self.client.get('/robots.txt')
        self.assertEqual(rb.status_code, 200)
        robots = rb.content.decode('utf-8')
        self.assertIn('Disallow: /api/', robots)
        self.assertIn('Sitemap: https://example.test/sitemap.xml', robots)

    def test_console_cms_auth_and_publish_validation(self):
        self.client.force_login(self.user)
        token = self._csrf()
        r = self.client.post(
            '/api/v1/console/blog/posts/',
            data=json.dumps({'slug': 'x'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 403)

        self.client.force_login(self.staff)
        token = self._csrf()
        r = self.client.post(
            '/api/v1/console/blog/posts/',
            data=json.dumps(
                {
                    'slug': 'empty-body',
                    'translations': {'zh-CN': {'title': '只有标题', 'body_markdown': ''}},
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 201, r.content)
        post_id = r.json()['data']['id']
        token = self._csrf()
        bad = self.client.post(
            f'/api/v1/console/blog/posts/{post_id}/publish/',
            data='{}',
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.json()['code'], 'VALIDATION_ERROR')
