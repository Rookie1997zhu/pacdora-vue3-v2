"""Container healthcheck: GET /api/v1/health/ on localhost."""
from __future__ import annotations

import json
import os
import urllib.request


def main() -> int:
    port = os.environ.get('PORT', '8000')
    url = f'http://127.0.0.1:{port}/api/v1/health/'
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            ok = resp.status == 200 and data.get('code') == 'OK'
            return 0 if ok else 1
    except Exception:
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
