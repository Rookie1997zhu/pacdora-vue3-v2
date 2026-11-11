from __future__ import annotations


class ProviderError(Exception):
    def __init__(self, message: str, *, code='PROVIDER_ERROR', status=502):
        super().__init__(message)
        self.code = code
        self.status = status


class BaseImageProvider:
    name = 'base'

    def generate_image(self, prompt: str, **meta) -> bytes:
        raise NotImplementedError
