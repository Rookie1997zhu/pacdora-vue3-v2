from __future__ import annotations

from urllib.parse import urlparse

from scrapy.exceptions import IgnoreRequest


class AllowedOriginRedirectMiddleware:
    """Block redirects that leave the job allowlist hosts."""

    def process_response(self, request, response, spider):
        allowed = set(getattr(spider, 'allowed_hosts', []) or [])
        if not allowed:
            return response
        host = (urlparse(response.url).hostname or '').lower()
        if host and host not in allowed:
            raise IgnoreRequest(f'redirect_host_blocked:{host}')
        return response
