from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from apps.dieline_library.scrapy_packative.svg_validate import is_valid_dieline_svg


@dataclass
class CrawlReport:
    items: list[dict[str, Any]] = field(default_factory=list)
    fetched_ok: list[dict[str, Any]] = field(default_factory=list)
    failed: list[dict[str, Any]] = field(default_factory=list)
    paused: list[dict[str, Any]] = field(default_factory=list)
    bytes_downloaded: int = 0
    error: str = ''


def build_cdn_url(template: str, tenant: str, product: str, L: int, W: int, H: int) -> str:
    return (
        template.replace('{tenant}', tenant)
        .replace('{product}', product)
        .replace('{L}', str(int(L)))
        .replace('{W}', str(int(W)))
        .replace('{H}', str(int(H)))
    )


def build_targets(contract: dict[str, Any], dimension_plan: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    template = contract['cdn_template']
    tenant = contract['tenant']
    product = contract['product']
    plan = dimension_plan if dimension_plan is not None else contract.get('targets') or []
    out: list[dict[str, Any]] = []
    for row in plan:
        L, W, H = int(row['L']), int(row['W']), int(row['H'])
        url = build_cdn_url(template, tenant, product, L, W, H)
        out.append(
            {
                'key': f'{product}_{L}_{W}_{H}',
                'L': L,
                'W': W,
                'H': H,
                'reason': row.get('reason') or '',
                'url': url,
            }
        )
    return out


def assert_url_allowed(url: str, allowed_origins: list[str]) -> None:
    parsed = urlparse(url)
    if parsed.scheme != 'https':
        raise ValueError('SSRF_SCHEME_BLOCKED')
    host = (parsed.hostname or '').lower()
    if not host:
        raise ValueError('SSRF_HOST_BLOCKED')
    # Block obvious private hosts
    if host in {'localhost', '127.0.0.1', '0.0.0.0', '::1'} or host.endswith('.local'):
        raise ValueError('SSRF_PRIVATE_HOST')
    if host.startswith('10.') or host.startswith('192.168.') or host.startswith('169.254.'):
        raise ValueError('SSRF_PRIVATE_HOST')
    allowed_hosts = set()
    for origin in allowed_origins or []:
        oh = urlparse(origin if '://' in origin else f'https://{origin}').hostname
        if oh:
            allowed_hosts.add(oh.lower())
    if allowed_hosts and host not in allowed_hosts:
        raise ValueError('SSRF_HOST_BLOCKED')


def run_cdn_crawl(job_ctx: dict[str, Any]) -> CrawlReport:
    """
    Run CDN crawl.

    Prefer Scrapy subprocess (avoids Twisted reactor conflicts with Django tests).
    Set PACKATIVE_CRAWL_BACKEND=direct to use urllib (used by unit tests with mocks).
    """
    backend = (os.environ.get('PACKATIVE_CRAWL_BACKEND') or 'scrapy').strip().lower()
    if backend == 'direct' or job_ctx.get('backend') == 'direct':
        return _run_direct(job_ctx)
    return _run_scrapy_subprocess(job_ctx)


def _run_scrapy_subprocess(job_ctx: dict[str, Any]) -> CrawlReport:
    output_dir = Path(job_ctx['output_dir'])
    output_dir.mkdir(parents=True, exist_ok=True)
    results_path = Path(job_ctx.get('results_path') or (output_dir / 'results.json'))
    job_ctx = {**job_ctx, 'results_path': str(results_path), 'output_dir': str(output_dir)}

    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as fh:
        json.dump(job_ctx, fh, ensure_ascii=False)
        job_json_path = fh.name

    scrapy_project = Path(__file__).resolve().parent
    env = os.environ.copy()
    # Ensure Django apps package is importable when Scrapy loads spiders.
    backend_root = str(scrapy_project.parents[3])  # .../backend
    env['PYTHONPATH'] = os.pathsep.join([backend_root, env.get('PYTHONPATH', '')]).strip(os.pathsep)
    env['SCRAPY_SETTINGS_MODULE'] = 'apps.dieline_library.scrapy_packative.settings'
    if job_ctx.get('download_delay') is not None:
        # Spider also applies delay; settings default remains.
        pass

    cmd = [
        sys.executable,
        '-m',
        'scrapy',
        'crawl',
        'cdn_dieline',
        '-a',
        f'job_json_path={job_json_path}',
        '-s',
        f'DOWNLOAD_DELAY={float(job_ctx.get("download_delay") or 10)}',
        '-s',
        'LOG_LEVEL=WARNING',
    ]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(scrapy_project),
            env=env,
            capture_output=True,
            text=True,
            timeout=int(job_ctx.get('timeout_seconds') or 600),
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        return CrawlReport(error=f'timeout:{exc}')
    finally:
        try:
            Path(job_json_path).unlink(missing_ok=True)
        except Exception:
            pass

    if not results_path.exists():
        err = (proc.stderr or proc.stdout or 'scrapy_no_results')[:2000]
        return CrawlReport(error=f'scrapy_failed:{err}')

    data = json.loads(results_path.read_text(encoding='utf-8'))
    items = data.get('items') or []
    report = CrawlReport(
        items=items,
        fetched_ok=[i for i in items if i.get('status') == 'ok'],
        failed=[i for i in items if i.get('status') == 'failed'],
        paused=[i for i in items if i.get('status') == 'paused'],
        bytes_downloaded=sum(int(i.get('bytes') or 0) for i in items if i.get('status') == 'ok'),
    )
    if proc.returncode != 0 and not items:
        report.error = (proc.stderr or proc.stdout or f'exit_{proc.returncode}')[:2000]
    return report


def _run_direct(job_ctx: dict[str, Any]) -> CrawlReport:
    """urllib-based fetcher for tests / fallback without Scrapy reactor."""
    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen

    output_dir = Path(job_ctx['output_dir'])
    output_dir.mkdir(parents=True, exist_ok=True)
    allowed = job_ctx.get('allowed_origins') or []
    items: list[dict[str, Any]] = []
    bytes_downloaded = 0

    for target in job_ctx.get('targets') or []:
        url = target['url']
        row: dict[str, Any] = {
            'key': target['key'],
            'url': url,
            'L': target.get('L'),
            'W': target.get('W'),
            'H': target.get('H'),
            'reason': target.get('reason') or '',
        }
        try:
            assert_url_allowed(url, allowed)
        except ValueError as exc:
            row.update({'status': 'failed', 'failure_code': str(exc), 'detail': str(exc)})
            items.append(row)
            continue
        try:
            req = Request(url, headers={'User-Agent': 'BOXCRAFT-DielineCollector/1.0 (+local; direct)'})
            with urlopen(req, timeout=float(job_ctx.get('request_timeout') or 30)) as resp:
                body = resp.read()
                status = getattr(resp, 'status', 200) or 200
        except HTTPError as exc:
            status = exc.code
            body = exc.read() if hasattr(exc, 'read') else b''
            if status == 401:
                row.update({'status': 'paused', 'failure_code': 'http_401', 'http_status': status, 'detail': 'unauthorized'})
                items.append(row)
                continue
            if status == 429:
                row.update({'status': 'paused', 'failure_code': 'http_429', 'http_status': status, 'detail': 'rate_limited'})
                items.append(row)
                continue
            if status == 403:
                row.update({'status': 'failed', 'failure_code': 'http_403', 'http_status': status, 'detail': 'forbidden'})
                items.append(row)
                continue
            text = body.decode('utf-8', errors='replace') if body else ''
            ok, detail = is_valid_dieline_svg(text) if text else (False, f'http_{status}')
            if not ok and detail == 'access_denied_xml':
                row.update({'status': 'failed', 'failure_code': 'ACCESS_DENIED', 'http_status': status, 'detail': detail})
            else:
                row.update({'status': 'failed', 'failure_code': f'http_{status}', 'http_status': status, 'detail': detail})
            items.append(row)
            continue
        except URLError as exc:
            row.update({'status': 'failed', 'failure_code': 'REQUEST_ERROR', 'detail': str(exc.reason)[:300]})
            items.append(row)
            continue

        text = body.decode('utf-8', errors='replace')
        ok, detail = is_valid_dieline_svg(text)
        if not ok:
            row.update(
                {
                    'status': 'failed',
                    'failure_code': 'ACCESS_DENIED' if detail == 'access_denied_xml' else 'SVG_INVALID',
                    'http_status': status,
                    'detail': detail,
                    'bytes': len(body),
                }
            )
            items.append(row)
            continue

        path = output_dir / f"{row['key']}.svg"
        path.write_text(text, encoding='utf-8')
        import hashlib

        row.update(
            {
                'status': 'ok',
                'http_status': status,
                'path': str(path),
                'bytes': len(body),
                'sha256': hashlib.sha256(body).hexdigest(),
                'detail': detail,
            }
        )
        bytes_downloaded += len(body)
        items.append(row)

    results_path = Path(job_ctx.get('results_path') or (output_dir / 'results.json'))
    payload = {
        'items': items,
        'fetched_ok': [i for i in items if i.get('status') == 'ok'],
        'failed': [i for i in items if i.get('status') == 'failed'],
        'paused': [i for i in items if i.get('status') == 'paused'],
    }
    results_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return CrawlReport(
        items=items,
        fetched_ok=payload['fetched_ok'],
        failed=payload['failed'],
        paused=payload['paused'],
        bytes_downloaded=bytes_downloaded,
    )
