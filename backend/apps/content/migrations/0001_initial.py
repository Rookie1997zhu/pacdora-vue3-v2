import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BlogPost',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('slug', models.SlugField(max_length=160, unique=True)),
                (
                    'status',
                    models.CharField(
                        choices=[('draft', 'Draft'), ('published', 'Published')],
                        default='draft',
                        max_length=20,
                    ),
                ),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('cover_url', models.URLField(blank=True, max_length=500)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'author',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='blog_posts',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name='BlogPostTranslation',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    'locale',
                    models.CharField(choices=[('zh-CN', 'Chinese'), ('ko-KR', 'Korean')], max_length=10),
                ),
                ('title', models.CharField(max_length=240)),
                ('excerpt', models.TextField(blank=True)),
                ('body_markdown', models.TextField(blank=True)),
                ('body_html_cache', models.TextField(blank=True)),
                ('meta_description', models.CharField(blank=True, max_length=320)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'post',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='translations',
                        to='content.blogpost',
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name='blogpost',
            index=models.Index(fields=['status', '-published_at'], name='content_blo_status_7d2a1c_idx'),
        ),
        migrations.AddIndex(
            model_name='blogpost',
            index=models.Index(fields=['-updated_at'], name='content_blo_updated_9f4e2b_idx'),
        ),
        migrations.AddIndex(
            model_name='blogposttranslation',
            index=models.Index(fields=['locale', 'title'], name='content_blo_locale_3a8c5d_idx'),
        ),
        migrations.AddConstraint(
            model_name='blogposttranslation',
            constraint=models.UniqueConstraint(fields=('post', 'locale'), name='uniq_blog_post_locale'),
        ),
    ]
