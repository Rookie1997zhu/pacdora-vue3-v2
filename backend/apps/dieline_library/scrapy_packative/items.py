from __future__ import annotations

import scrapy


class DielineFetchItem(scrapy.Item):
    key = scrapy.Field()
    url = scrapy.Field()
    L = scrapy.Field()
    W = scrapy.Field()
    H = scrapy.Field()
    reason = scrapy.Field()
    status = scrapy.Field()
    http_status = scrapy.Field()
    detail = scrapy.Field()
    path = scrapy.Field()
    bytes = scrapy.Field()
    sha256 = scrapy.Field()
    failure_code = scrapy.Field()
