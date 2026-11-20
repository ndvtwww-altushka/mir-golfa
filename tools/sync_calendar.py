#!/usr/bin/env python3
"""Собирает официальный календарь АГР и обновляет данные проекта.

Источник: https://rusgolf.ru/ru/contests/tournament-calendar
Разрешён только разбор публичной страницы; перед промышленной эксплуатацией
проверьте правила сайта и получите разрешение на автоматический доступ.

Запуск:
    python3 tools/sync_calendar.py            # обновить seed и bootstrap
    python3 tools/sync_calendar.py --check    # только проверить разбор (для CI)
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
from datetime import date, datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = ROOT / "backend" / "data" / "events.seed.json"
BOOTSTRAP_PATH = ROOT / "mobile" / "src" / "data" / "bootstrap.json"
CLUBS_PATH = ROOT / "backend" / "data" / "clubs.seed.json"
SOURCES_PATH = ROOT / "backend" / "data" / "sources.json"

CALENDAR_URL = "https://rusgolf.ru/ru/contests/tournament-calendar"
USER_AGENT = "MirGolfaBot/1.0 (+https://github.com/ndvtwww-altushka/mir-golfa)"
MIN_EXPECTED_EVENTS = 10

sys.path.insert(0, str(ROOT / "backend"))

MONTHS = {
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4, "мая": 5, "июня": 6,
    "июля": 7, "августа": 8, "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12,
}
LEVELS = {
    "ВС": "Всероссийский",
    "РС": "Региональный",
    "АКР": "Аккредитованный",
    "-": "Любительский",
}
REGION_ALIASES = {
    "г. Санкт-Петербург": "Санкт-Петербург",
    "Санкт-Петербург": "Санкт-Петербург",
    "Московская обл.": "Московская область",
    "Ленинградская обл.": "Ленинградская область",
    "Тверская обл.": "Тверская область",
    "Самарская обл.": "Самарская область",
    "Чувашская респ.": "Чувашская Республика",
    "Республика Татарстан": "Республика Татарстан",
    "Краснодарский край": "Краснодарский край",
    "Свердловская область": "Свердловская область",
}

_TAG_RE = re.compile(r"<[^>]+>")


def clean(value: str) -> str:
    value = _TAG_RE.sub("", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def parse_range(label: str, year: int) -> tuple[str, str] | None:
    """'8-11 апреля' / '14 мая' / '31 мая – 6 июня' -> ISO интервал."""
    text = label.replace("–", "-").replace("—", "-")
    text = re.sub(r"\s+", " ", text).strip()
    parts = [part.strip() for part in text.split("-") if part.strip()]

    def day_month(part: str):
        match = re.match(r"^(\d{1,2})(?:\s+([А-Яа-яЁё]+))?$", part)
        if not match:
            return None
        month = MONTHS.get((match.group(2) or "").lower())
        return int(match.group(1)), month

    if len(parts) == 1:
        single = day_month(parts[0])
        if not single or not single[1]:
            return None
        start = end = {"day": single[0], "month": single[1], "year": year}
    else:
        first, last = day_month(parts[0]), day_month(parts[-1])
        if not first or not last:
            return None
        end_month = last[1] or first[1]
        start_month = first[1] or last[1]
        if not start_month or not end_month:
            return None
        start = {"day": first[0], "month": start_month, "year": year}
        end = {"day": last[0], "month": end_month, "year": year + (1 if end_month < start_month else 0)}
    iso = lambda item: f"{item['year']:04d}-{item['month']:02d}-{item['day']:02d}"
    return iso(start), iso(end)


def region_of(place: str) -> str:
    raw = place.split(",")[0].strip()
    if raw in REGION_ALIASES:
        return REGION_ALIASES[raw]
    if raw.endswith(" обл."):
        return raw[:-5] + " область"
    return re.sub(r"^г\.\s*", "", raw).strip()


def venue_of(place: str) -> str:
    match = re.search(r"«([^»]+)»", place)
    if match:
        return match.group(1)
    tail = place.split(",")[-1].strip()
    return re.sub(r"^(ГК|БО|ЛДС|ГБУ ДО СШОР)\s*", "", tail).strip() or place


def parse_calendar(page: str) -> tuple[int, list[dict]]:
    year_match = re.search(r"на\s+(\d{4})\s+год", page)
    season = int(year_match.group(1)) if year_match else date.today().year
    rows = []
    for chunk in page.split('<tr class="')[1:]:
        segment = chunk.split("</tr>")[0]
        date_match = re.search(r'class="f24 red"[^>]*>(.*?)</span>', segment, re.S)
        venue_match = re.search(r'class="link"[^>]*>(.*?)</span>', segment, re.S)
        if not date_match or not venue_match:
            continue
        after_venue = segment[segment.index(venue_match.group(0)) + len(venue_match.group(0)):]
        name_match = re.search(r"<br[^>]*>(.*?)</td>", after_venue, re.S)
        code_match = re.search(r"Статус</span>.*?<span[^>]*>(.*?)</span>", segment, re.S)
        org_match = re.search(r"Организатор</span>.*?<br[^>]*>(.*?)</td>", segment, re.S)
        rows.append({
            "date_label": clean(date_match.group(1)),
            "place": clean(venue_match.group(1)),
            "name": clean(name_match.group(1)) if name_match else "",
            "code": clean(code_match.group(1)) if code_match else "-",
            "organizer": clean(org_match.group(1)) if org_match else "",
        })

    today = date.today().isoformat()
    events, sequence = [], {}
    for row in rows:
        if not row["name"]:
            continue
        interval = parse_range(row["date_label"], season)
        if not interval:
            print(f"warning: не удалось разобрать дату '{row['date_label']}'", file=sys.stderr)
            continue
        start, end = interval
        sequence[start] = sequence.get(start, 0) + 1
        region = region_of(row["place"])
        is_junior = bool(re.search(r"юниор|детск|школьн|первенств", row["name"], re.I))
        is_mini = bool(re.search(r"мини-гольф", row["name"], re.I))
        events.append({
            "id": f"agr-{start}-{sequence[start]}",
            "name": row["name"],
            "sport": "mini_golf" if is_mini else "golf",
            "start_date": start,
            "end_date": end,
            "country": "Россия",
            "region": region,
            "city": "Санкт-Петербург" if region == "Санкт-Петербург" else None,
            "venue": venue_of(row["place"]),
            "level": LEVELS.get(row["code"], "Любительский"),
            "age_group": "Юниоры" if is_junior else None,
            "event_status": "unknown",
            "registration_status": "unknown",
            "organizer": row["organizer"] or None,
            "summary": "Даты и площадка перенесены из официального календаря АГР. "
                       "Статус проведения и протокол требуют отдельного подтверждения.",
            "source_id": "rusgolf-calendar",
            "source_url": CALENDAR_URL,
            "source_excerpt": f"{row['date_label']}; {row['place']}; {row['name']}.",
            "published": True,
            "verified_at": None,
            "last_checked_at": today + "T00:00:00Z",
        })
    return season, events


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_bootstrap(events: list[dict], sources: list[dict], clubs: list[dict], season: int) -> dict:
    from app.domain import event_to_public

    authority = {source["id"]: source for source in sources}
    public_events = []
    for event in events:
        if not event.get("published", True):
            continue
        item = event_to_public(event)
        source = authority.get(event.get("source_id"), {})
        item["source_name"] = source.get("name")
        item["source_authority"] = source.get("authority")
        public_events.append(item)
    public_events.sort(key=lambda item: (item["start_date"], item["name"]))

    today = date.today().isoformat()
    upcoming = [item for item in public_events if item["end_date"] >= today]
    stats = {
        "published_events": len(public_events),
        "upcoming_events": len(upcoming),
        "verified_results": 0,
        "verified_clubs": len([club for club in clubs if club.get("evidence_state") == "verified"]),
        "enabled_sources": len([source for source in sources if source.get("enabled", True)]),
        "season": season,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    }
    return {
        "generated_at": stats["generated_at"],
        "season": season,
        "season_closed": not upcoming,
        "events": public_events,
        "sources": sources,
        "clubs": clubs,
        "results": [],
        "stats": stats,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Обновление календаря АГР")
    parser.add_argument("--check", action="store_true", help="только проверить разбор, ничего не писать")
    parser.add_argument("--offline", action="store_true", help="не ходить в сеть, пересобрать bootstrap из seed")
    args = parser.parse_args()

    existing = load_json(SEED_PATH, [])
    if args.offline:
        season = 2026
        fresh = []
        merged = existing
    else:
        page = fetch(CALENDAR_URL)
        season, fresh = parse_calendar(page)
        print(f"календарь АГР: сезон {season}, событий найдено: {len(fresh)}")
        if len(fresh) < MIN_EXPECTED_EVENTS:
            print(f"error: найдено меньше {MIN_EXPECTED_EVENTS} событий — похоже, изменилась вёрстка", file=sys.stderr)
            return 2
        # События АГР заменяем целиком, ручные записи (GreenFee и т. п.) сохраняем.
        kept = [event for event in existing if event.get("source_id") != "rusgolf-calendar"]
        merged = sorted(kept + fresh, key=lambda item: (item["start_date"], item["name"]))
        print(f"в seed: было {len(existing)}, стало {len(merged)} (АГР {len(fresh)} + вручную {len(kept)})")

    if args.check:
        print("check: ok")
        return 0

    sources = load_json(SOURCES_PATH, [])
    clubs = load_json(CLUBS_PATH, [])
    bootstrap = build_bootstrap(merged, sources, clubs, season)

    if not args.offline:
        write_json(SEED_PATH, merged)
    write_json(BOOTSTRAP_PATH, bootstrap)
    print(f"bootstrap: {len(bootstrap['events'])} событий, {len(bootstrap['clubs'])} клубов, "
          f"{len(bootstrap['sources'])} источников -> {BOOTSTRAP_PATH.relative_to(ROOT)}")
    print(f"ближайших (end_date >= {date.today().isoformat()}): {bootstrap['stats']['upcoming_events']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
