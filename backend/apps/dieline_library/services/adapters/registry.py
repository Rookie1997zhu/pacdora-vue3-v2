from __future__ import annotations

from apps.dieline_library.services.adapters.authorized_online import (
    AuthorizedApiAdapter,
    AuthorizedBrowserAdapter,
)
from apps.dieline_library.services.adapters.base import AdapterError, SourceAdapter
from apps.dieline_library.services.adapters.local_manifest import LocalManifestAdapter
from apps.dieline_library.services.adapters.supplier_package import SupplierPackageAdapter

_REGISTRY: dict[str, type[SourceAdapter]] = {
    LocalManifestAdapter.adapter_type: LocalManifestAdapter,
    SupplierPackageAdapter.adapter_type: SupplierPackageAdapter,
    AuthorizedBrowserAdapter.adapter_type: AuthorizedBrowserAdapter,
    AuthorizedApiAdapter.adapter_type: AuthorizedApiAdapter,
}


def get_adapter(adapter_type: str) -> SourceAdapter:
    cls = _REGISTRY.get(adapter_type)
    if not cls:
        raise AdapterError(f'unknown adapter_type: {adapter_type}', code='UNKNOWN_ADAPTER')
    return cls()


def list_adapter_types() -> list[str]:
    return sorted(_REGISTRY.keys())
