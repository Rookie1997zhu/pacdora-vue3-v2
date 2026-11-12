from __future__ import annotations


def paginate_queryset(qs, request, *, default_size=20, max_size=100):
    try:
        page = max(1, int(request.query_params.get('page', 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = min(max_size, max(1, int(request.query_params.get('page_size', default_size))))
    except (TypeError, ValueError):
        page_size = default_size
    total = qs.count()
    start = (page - 1) * page_size
    items = list(qs[start : start + page_size])
    return items, {
        'page': page,
        'page_size': page_size,
        'total': total,
        'has_next': start + page_size < total,
    }
