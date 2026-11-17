from django.urls import path

from apps.content.views_api import LocaleHintView
from apps.content.views_blog_api import PublicBlogPostDetailView, PublicBlogPostListView

urlpatterns = [
    path('site/locale-hint/', LocaleHintView.as_view()),
    path('blog/posts/', PublicBlogPostListView.as_view()),
    path('blog/posts/<slug:slug>/', PublicBlogPostDetailView.as_view()),
]
