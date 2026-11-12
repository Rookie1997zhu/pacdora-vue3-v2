from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

import scrapy

from apps.dieline_library.scrapy_packative.items import DielineFetchItem


class CdnDielineSpider(scrapy.Spider):
    name = 'cdn_dieline'
    custom_settings = {
        'DOWNLOAD_TIMEOUT': 60,
    }

    def __init__(self, job_json_path: str = '', *args, **kwargs):
        super().__init__(*args, **kwargs)
        raw = json.loads(Path(job_json_path).read_text(encoding='utf-8'))
        self.job_ctx = raw
        self.output_dir = Path(raw['output_dir'])
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.results_path = Path(raw['results_path'])
        self.allowed_hosts = [urlparse(o).hostname for o in raw.get('allowed_origins', []) if urlparse(o).hostname]
        self.allowed_hosts = [h.lower() for h in self.allowed_hosts if h]
        delay = float(raw.get('download_delay') or 10)
        self.custom_settings = {**self.custom_settings, 'DOWNLOAD_DELAY': delay}
        self._collected: list[dict] = []

    def start_requests(self):
        for target in self.job_ctx.get('targets') or []:
            url = target['url']
            host = (urlparse(url).hostname or '').lower()
            if self.allowed_hosts and host not in self.allowed_hosts:
                item = DielineFetchItem(
                    key=target['key'],
                    url=url,
                    L=target.get('L'),
                    W=target.get('W'),
                    H=target.get('H'),
                    reason=target.get('reason') or '',
                    status='failed',
                    failure_code='SSRF_HOST_BLOCKED',
                    detail=f'host_not_allowed:{host}',
                )
                yield item
                continue
            yield scrapy.Request(
                url,
                callback=self.parse_dieline,
                errback=self.errback,
                dont_filter=True,
                meta={'target': target},
            )

    def parse_dieline(self, response):
        target = response.meta['target']
        item = DielineFetchItem(
            key=target['key'],
            url=response.url,
            L=target.get('L'),
            W=target.get('W'),
            H=target.get('H'),
            reason=target.get('reason') or '',
            http_status=response.status,
            status='ok',
        )
        if response.status == 401:
            item['status'] = 'paused'
            item['failure_code'] = 'http_401'
            item['detail'] = 'unauthorized'
            self._collected.append(dict(item))
            return item
        if response.status == 429:
            item['status'] = 'paused'
            item['failure_code'] = 'http_429'
            item['detail'] = 'rate_limited'
            self._collected.append(dict(item))
            return item
        if response.status == 403:
            item['status'] = 'failed'
            item['failure_code'] = 'http_403'
            item['detail'] = 'forbidden'
            self._collected.append(dict(item))
            return item
        if response.status >= 400:
            item['status'] = 'failed'
            item['failure_code'] = f'http_{response.status}'
            item['detail'] = f'http_{response.status}'
            self._collected.append(dict(item))
            return item

        body = response.body
        item['bytes'] = len(body)
        item['_body'] = body  # consumed by pipeline; stripped before persist JSON
        self._collected.append(dict(item))
        return item

    def errback(self, failure):
        request = failure.request
        target = request.meta.get('target') or {}
        item = DielineFetchItem(
            key=target.get('key') or request.url,
            url=request.url,
            L=target.get('L'),
            W=target.get('W'),
            H=target.get('H'),
            reason=target.get('reason') or '',
            status='failed',
            failure_code='REQUEST_ERROR',
            detail=str(failure.value)[:300],
        )
        self._collected.append(dict(item))
        return item

    def closed(self, reason):
        # Ensure results file exists even if pipeline missed some items.
        if not self.results_path.exists():
            cleaned = []
            for row in self._collected:
                row = dict(row)
                row.pop('_body', None)
                cleaned.append(row)
            self.results_path.write_text(json.dumps({'items': cleaned, 'reason': reason}, ensure_ascii=False), encoding='utf-8')
