from django.urls import path

from apps.content import views_public

urlpatterns = [
    # Legacy HTML blog paths → SPA (only hit when talking to backend directly)
    path('blog/', views_public.blog_spa_redirect_root, name='blog-root'),
    path('blog/<str:lang>/', views_public.blog_spa_redirect_list, name='blog-list'),
    path('blog/<str:lang>/<slug:slug>/', views_public.blog_spa_redirect_detail, name='blog-detail'),
    path('robots.txt', views_public.robots_txt, name='robots'),
    path('sitemap.xml', views_public.sitemap_xml, name='sitemap'),
]
