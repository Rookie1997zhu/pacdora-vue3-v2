BOT_NAME = 'scrapy_packative'
SPIDER_MODULES = ['apps.dieline_library.scrapy_packative.spiders']
NEWSPIDER_MODULE = 'apps.dieline_library.scrapy_packative.spiders'

ROBOTSTXT_OBEY = False
CONCURRENT_REQUESTS = 1
CONCURRENT_REQUESTS_PER_DOMAIN = 1
DOWNLOAD_DELAY = 10
COOKIES_ENABLED = False
TELNETCONSOLE_ENABLED = False
LOG_LEVEL = 'WARNING'
USER_AGENT = 'BOXCRAFT-DielineCollector/1.0 (+local; Scrapy)'

ITEM_PIPELINES = {
    'apps.dieline_library.scrapy_packative.pipelines.DielineValidatePipeline': 100,
    'apps.dieline_library.scrapy_packative.pipelines.DielinePersistPipeline': 200,
}

DOWNLOADER_MIDDLEWARES = {
    'apps.dieline_library.scrapy_packative.middlewares.AllowedOriginRedirectMiddleware': 50,
}

DEFAULT_REQUEST_HEADERS = {
    'Accept': 'image/svg+xml,application/xml;q=0.9,*/*;q=0.8',
}
