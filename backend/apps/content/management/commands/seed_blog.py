from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.content.models import BlogPost, BlogPostTranslation
from apps.content.services import publish_post, refresh_translation_html


SEED = [
    {
        'slug': 'cosmetic-box-guide',
        'tags': ['cosmetic', 'paper'],
        'cover_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
        'zh': {
            'title': '化妆品盒怎么选结构与纸材',
            'excerpt': '从展示面、开合方式到白卡/涂层纸的选择要点。',
            'meta_description': '化妆品包装盒结构与纸材选型指南，适合礼盒与货架展示。',
            'body_markdown': '''## 适用场景

化妆品盒强调展示面与开启体验。常见方向：

- 天地盖 / 抽屉盒：高端礼盒
- 插口盒：轻量电商试装

## 纸材建议

参考韩国常用纸种目录：

- **艺术纸 / 白卡 250–350g**：印刷清晰，适合彩印面
- **过重内容物**：避免单独使用过薄艺术纸做过高盒身

## 设计提示

先在 Studio 选纸种并查看内外尺寸，再用示例设计检查主展示面。
''',
        },
        'ko': {
            'title': '화장품 박스 구조·지종 고르는 법',
            'excerpt': '디스플레이 면, 개폐 방식, 아트지/백판지 선택 포인트.',
            'meta_description': '화장품 패키지 구조와 지종 선택 가이드.',
            'body_markdown': '''## 사용 장면

화장품 박스는 디스플레이와 개봉 경험이 중요합니다.

- 뚜껑형/서랍형: 프리미엄 선물
- 꽂이형: 가벼운 이커머스 샘플

## 지종 추천

한국 상용 지종 카탈로그 기준:

- **아트지/백판 250–350g**: 인쇄가 선명
- **무거운 내용물**: 얇은 아트지만으로 높은 박스를 만들지 마세요

## 디자인 팁

Studio에서 지종을 고르고 안·밖 치수를 확인한 뒤, 예시 디자인으로 메인 면을 점검하세요.
''',
        },
    },
    {
        'slug': 'gift-box-paper',
        'tags': ['gift', 'paper'],
        'cover_url': 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=80',
        'zh': {
            'title': '礼品盒纸材与厚度速查',
            'excerpt': '送礼场景下克重、表面质感与结构强度的平衡。',
            'meta_description': '礼品盒纸材与厚度速查，含牛皮与涂层对比。',
            'body_markdown': '''## 礼品感从何而来

- **涂层白卡**：光滑印刷、色彩饱和
- **牛皮纸**：自然触感，适合简约礼品

## 厚度

- 150–250g：轻礼 / 内衬盒
- 350g 或 E 楞：需要更好挺度时

在 Studio 切换纸种后，留意外侧尺寸会随厚度略增。
''',
        },
        'ko': {
            'title': '선물 박스 지종·두께 빠른 가이드',
            'excerpt': '선물 장면에서 평량, 질감, 구조 강도의 균형.',
            'meta_description': '선물 박스 지종과 두께 가이드.',
            'body_markdown': '''## 선물감은 어디서

- **코팅 백판**: 매끄러운 인쇄
- **크라프트**: 자연스러운 촉감

## 두께

- 150–250g: 가벼운 선물/속박스
- 350g 또는 E골: 더 단단할 때

Studio에서 지종을 바꾸면 바깥 치수가 두께에 따라 조금 커집니다.
''',
        },
    },
    {
        'slug': 'shipping-box-corrugated',
        'tags': ['shipping', 'corrugated'],
        'cover_url': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
        'zh': {
            'title': '运输箱与瓦楞选择',
            'excerpt': 'E/B 楞适用场景，以及外箱装箱引导。',
            'meta_description': '运输包装瓦楞选择与外箱装箱提示。',
            'body_markdown': '''## 何时用瓦楞

运输与堆码优先瓦楞：

- **E 楞**：较薄，适合电商小件
- **B 楞**：更高缓冲

## 与外箱

包装盒完成后，可用 Studio Outbox 估算能装多少个并生成外箱刀版。

薄纸 + 过高盒身会触发风险提示，请优先改纸种或降低高度。
''',
        },
        'ko': {
            'title': '운송 박스와 골판지 선택',
            'excerpt': 'E/B 골 사용 장면과 외박스 적재 안내.',
            'meta_description': '운송 포장 골판지 선택과 외박스 팁.',
            'body_markdown': '''## 골판지를 쓸 때

운송·적재에는 골판지가 우선입니다.

- **E골**: 얇고 이커머스 소형에 적합
- **B골**: 완충이 더 필요할 때

## 외박스

포장 박스가 끝나면 Studio Outbox로 적재 수량과 외박스 도면을 만들 수 있습니다.

얇은 지종 + 높은 박스는 위험 안내가 뜹니다. 지종을 바꾸거나 높이를 낮추세요.
''',
        },
    },
]


class Command(BaseCommand):
    help = 'Seed 3 bilingual sample blog posts (idempotent by slug).'

    def handle(self, *args, **options):
        created = 0
        for item in SEED:
            post, was_created = BlogPost.objects.get_or_create(
                slug=item['slug'],
                defaults={
                    'tags': item['tags'],
                    'cover_url': item.get('cover_url') or '',
                    'status': BlogPost.Status.DRAFT,
                },
            )
            if was_created:
                created += 1
            else:
                post.tags = item['tags']
                post.cover_url = item.get('cover_url') or post.cover_url
                post.save(update_fields=['tags', 'cover_url', 'updated_at'])
            for locale, key in (('zh-CN', 'zh'), ('ko-KR', 'ko')):
                payload = item[key]
                tr, _ = BlogPostTranslation.objects.update_or_create(
                    post=post,
                    locale=locale,
                    defaults={
                        'title': payload['title'],
                        'excerpt': payload['excerpt'],
                        'meta_description': payload['meta_description'],
                        'body_markdown': payload['body_markdown'],
                    },
                )
                refresh_translation_html(tr)
            if post.status != BlogPost.Status.PUBLISHED:
                publish_post(post)
            elif not post.published_at:
                post.published_at = timezone.now()
                post.save(update_fields=['published_at', 'updated_at'])
        self.stdout.write(self.style.SUCCESS(f'seed_blog done (new={created}, total={len(SEED)})'))
