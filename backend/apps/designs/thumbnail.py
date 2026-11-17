"""Dieline thumbnail enqueue helpers (B-05)."""

from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)


def content_has_image_layer(content: dict | None) -> bool:
    if not isinstance(content, dict):
        return False
    layers = (content.get('artwork') or {}).get('layers') or []
    for layer in layers:
        if isinstance(layer, dict) and layer.get('kind') == 'image' and layer.get('assetId'):
            return True
    return False


def enqueue_dieline_thumbnail_if_needed(design_id: str, revision_id: str) -> None:
    """Schedule dieline SVG thumbnail when revision has no image layers."""
    from apps.designs.models import DesignRevision
    from apps.designs.tasks import render_dieline_thumbnail

    rev = DesignRevision.objects.filter(id=revision_id, design_id=design_id).first()
    if not rev:
        return
    if content_has_image_layer(rev.content_json):
        return

    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        render_dieline_thumbnail(str(design_id), str(revision_id))
        return

    transaction.on_commit(lambda: render_dieline_thumbnail.delay(str(design_id), str(revision_id)))
