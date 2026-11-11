import hashlib

from apps.ai_jobs.providers.base import BaseImageProvider

# 1x1 PNG
_PNG = bytes.fromhex(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
    '0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082'
)


class TestProvider(BaseImageProvider):
    name = 'test'

    def generate_image(self, prompt: str, **meta) -> bytes:
        # Deterministic tiny PNG; prompt hash kept in caller meta if needed
        _ = hashlib.sha256((prompt or '').encode('utf-8')).hexdigest()
        return _PNG
