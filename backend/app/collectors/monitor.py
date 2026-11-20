from __future__ import annotations
import hashlib
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

from ..db import db_session, init_database

USER_AGENT = os.getenv("GOLF_CIS_USER_AGENT", "MirGolfaBot/1.0 (contact: configure-real-email)")
TIMEOUT = (5, 15)
MAX_BYTES = 2_000_000
MIN_HOST_DELAY = 2.0
_robot_cache: dict[str, tuple[float, bool]] = {}
_host_last_request: dict[str, float] = {}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _robots_allows(url: str, session: requests.Session) -> bool:
    parsed = urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    cached = _robot_cache.get(origin)
    if cached and time.monotonic() - cached[0] < 3600:
        return cached[1]
    robots_url = origin + "/robots.txt"
    try:
        response = session.get(robots_url, timeout=TIMEOUT, allow_redirects=False)
        if response.status_code == 404:
            allowed = True  # missing file is not a disallow; terms still apply
        elif response.status_code == 200:
            parser = RobotFileParser()
            parser.parse(response.text.splitlines())
            allowed = parser.can_fetch(USER_AGENT, url)
        else:
            # 401/403/429/5xx and unknown responses fail closed.
            allowed = False
    except requests.RequestException:
        allowed = False
    _robot_cache[origin] = (time.monotonic(), allowed)
    return allowed


def _canonical_text(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    for node in soup(["script", "style", "noscript", "svg", "header", "footer", "nav", "aside"]):
        node.decompose()
    for node in soup.select("[aria-hidden='true'], .advert, .advertisement, .cookie-banner, .cookie-consent"):
        node.decompose()
    main = soup.find("main") or soup.find("article") or soup.body or soup
    text = " ".join(main.get_text(" ", strip=True).split())
    # Ignore tiny dynamic bits and keep a bounded fingerprint input.
    normalized = re.sub(r"\s+", " ", text).strip()[:500_000]
    return title[:500], normalized


def _wait_for_host(origin: str) -> None:
    wait = MIN_HOST_DELAY - (time.monotonic() - _host_last_request.get(origin, 0))
    if wait > 0:
        time.sleep(wait)


def _fetch_same_origin(url: str, session: requests.Session) -> requests.Response:
    original = urlparse(url)
    current = url
    for _ in range(4):
        parsed = urlparse(current)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if parsed.netloc.casefold() != original.netloc.casefold():
            raise RuntimeError("Перенаправление на другой host требует ручного разрешения")
        if not _robots_allows(current, session):
            raise RuntimeError("robots.txt не разрешает целевой URL")
        _wait_for_host(origin)
        response = session.get(current, timeout=TIMEOUT, stream=True, allow_redirects=False)
        _host_last_request[origin] = time.monotonic()
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("Location")
            response.close()
            if not location:
                raise RuntimeError("Redirect без заголовка Location")
            current = urljoin(current, location)
            continue
        return response
    raise RuntimeError("Слишком много перенаправлений")


def check_source(source: dict, session: requests.Session) -> dict:
    source_id, url = source["id"], source["url"]
    now = _utc_now()
    origin = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
    try:
        if not _robots_allows(url, session):
            raise RuntimeError("robots.txt не разрешает запрос или его нельзя проверить")
        response = _fetch_same_origin(url, session)
        if response.status_code >= 400:
            response.close()
            response.raise_for_status()
        if int(response.headers.get("Content-Length", "0") or 0) > MAX_BYTES:
            response.close()
            raise RuntimeError("Страница превышает лимит размера")
        content_type = response.headers.get("Content-Type", "").casefold()
        if "html" not in content_type and "text/plain" not in content_type:
            response.close()
            raise RuntimeError(f"Неподдерживаемый Content-Type: {content_type}")
        chunks: list[bytes] = []
        size = 0
        for chunk in response.iter_content(16_384):
            size += len(chunk)
            if size > MAX_BYTES:
                response.close()
                raise RuntimeError("Тело ответа превышает лимит размера")
            chunks.append(chunk)
        html = b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
        response.close()
        title, text = _canonical_text(html)
        digest = hashlib.sha256((title + "\n" + text).encode("utf-8")).hexdigest()
        with db_session() as con:
            previous = con.execute(
                "SELECT content_hash FROM source_snapshots WHERE source_id=? ORDER BY id DESC LIMIT 1",
                (source_id,)
            ).fetchone()
            changed = bool(previous and previous[0] != digest)
            cursor = con.execute(
                """INSERT INTO source_snapshots(source_id,checked_at,http_status,content_hash,page_title,changed,error)
                   VALUES(?,?,?,?,?,?,NULL)""",
                (source_id, now, response.status_code, digest, title, int(changed))
            )
            if changed:
                con.execute(
                    "INSERT INTO source_review_queue(source_id,snapshot_id,detected_at,reason) VALUES(?,?,?,?)",
                    (source_id, cursor.lastrowid, now, "Изменился текст страницы; проверить даты, условия и статус вручную.")
                )
            con.execute(
                "UPDATE sources SET last_attempt_at=?,last_success_at=?,last_error=NULL WHERE id=?",
                (now, now, source_id)
            )
        return {"source_id": source_id, "status": "ok", "changed": changed, "title": title}
    except Exception as exc:
        with db_session() as con:
            con.execute(
                "INSERT INTO source_snapshots(source_id,checked_at,error) VALUES(?,?,?)",
                (source_id, now, str(exc)[:1000])
            )
            con.execute(
                "UPDATE sources SET last_attempt_at=?,last_error=? WHERE id=?",
                (now, str(exc)[:1000], source_id)
            )
        return {"source_id": source_id, "status": "error", "error": str(exc)[:300]}


def run_once() -> dict:
    init_database()
    with db_session() as con:
        sources = [dict(row) for row in con.execute(
            "SELECT * FROM sources WHERE enabled=1 AND collection_mode='crawl_approved' ORDER BY id"
        ).fetchall()]
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    results = [check_source(source, session) for source in sources]
    session.close()
    return {
        "checked_at": _utc_now(),
        "approved_sources": len(sources),
        "ok": sum(r["status"] == "ok" for r in results),
        "changed": sum(bool(r.get("changed")) for r in results),
        "errors": sum(r["status"] == "error" for r in results),
        "results": results,
        "note": "Изменения создают очередь ручной проверки; парсер не публикует турниры автоматически."
    }


if __name__ == "__main__":
    import json
    print(json.dumps(run_once(), ensure_ascii=False, indent=2))
