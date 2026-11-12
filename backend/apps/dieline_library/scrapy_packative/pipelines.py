from __future__ import annotations

import hashlib
import json
from pathlib import Path

from apps.dieline_library.scrapy_packative.svg_validate import is_valid_dieline_svg


class DielineValidatePipeline:
    def process_item(self, item, spider):
        if item.get('status') in {'failed', 'paused'}:
            return item
        body = item.pop('_body', None)
        if body is None:
            item['status'] = 'failed'
            item['failure_code'] = 'EMPTY_BODY'
            return item
        try:
            text = body.decode('utf-8', errors='replace')
        except Exception:
            text = str(body)
        ok, detail = is_valid_dieline_svg(text)
        if not ok:
            item['status'] = 'failed'
            item['failure_code'] = 'SVG_INVALID' if detail != 'access_denied_xml' else 'ACCESS_DENIED'
            item['detail'] = detail
            return item
        item['_text'] = text
        item['sha256'] = hashlib.sha256(body).hexdigest()
        item['detail'] = detail
        return item


class DielinePersistPipeline:
    def open_spider(self, spider):
        self.items: list[dict] = []
        self.output_dir = Path(spider.output_dir)
        self.results_path = Path(spider.results_path)

    def process_item(self, item, spider):
        row = dict(item)
        text = row.pop('_text', None)
        row.pop('_body', None)
        if row.get('status') == 'ok' and text is not None:
            safe_key = str(row.get('key') or 'item').replace('/', '_').replace('\\', '_')
            path = self.output_dir / f'{safe_key}.svg'
            path.write_text(text, encoding='utf-8')
            row['path'] = str(path)
            row['bytes'] = len(text.encode('utf-8'))
        self.items.append(row)
        return item

    def close_spider(self, spider):
        payload = {
            'items': self.items,
            'fetched_ok': [i for i in self.items if i.get('status') == 'ok'],
            'failed': [i for i in self.items if i.get('status') == 'failed'],
            'paused': [i for i in self.items if i.get('status') == 'paused'],
        }
        self.results_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
