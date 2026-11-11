from django.urls import path

from apps.quotes.views import QuoteDetailView, QuoteListCreateView

urlpatterns = [
    path('quotes/', QuoteListCreateView.as_view()),
    path('quotes/<uuid:quote_id>/', QuoteDetailView.as_view()),
]
