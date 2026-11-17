from django.contrib import admin

from apps.content.models import BlogPost, BlogPostTranslation


class BlogPostTranslationInline(admin.TabularInline):
    model = BlogPostTranslation
    extra = 0


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('slug', 'status', 'published_at', 'updated_at')
    list_filter = ('status',)
    search_fields = ('slug',)
    inlines = [BlogPostTranslationInline]


@admin.register(BlogPostTranslation)
class BlogPostTranslationAdmin(admin.ModelAdmin):
    list_display = ('post', 'locale', 'title', 'updated_at')
    list_filter = ('locale',)
    search_fields = ('title', 'post__slug')
