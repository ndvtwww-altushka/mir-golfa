from __future__ import annotations
import json
import os
from contextlib import contextmanager
import sqlite3
from pathlib import Path
from typing import Any

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR.parent / "data"
DB_PATH = Path(os.getenv("GOLF_DATABASE_PATH", DATA_DIR / "mir_golfa.sqlite3"))


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 15000")
    return connection


@contextmanager
def db_session():
    connection = connect()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_database() -> None:
    schema = (APP_DIR / "schema.sql").read_text(encoding="utf-8")
    with db_session() as con:
        con.executescript(schema)
        _seed_sources(con)
        _seed_events(con)
        _seed_clubs(con)


def _seed_sources(con: sqlite3.Connection) -> None:
    sources: list[dict[str, Any]] = json.loads((DATA_DIR / "sources.json").read_text(encoding="utf-8"))
    for source in sources:
        con.execute(
            """INSERT OR IGNORE INTO sources
               (id, name, url, country, source_type, authority, collection_mode, enabled)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (source["id"], source["name"], source["url"], source.get("country"),
             source["source_type"], source["authority"], source["collection_mode"],
             int(source.get("enabled", True)))
        )


def _seed_events(con: sqlite3.Connection) -> None:
    events: list[dict[str, Any]] = json.loads((DATA_DIR / "events.seed.json").read_text(encoding="utf-8"))
    columns = (
        "id,name,sport,start_date,end_date,country,region,city,venue,venue_address,format,eligibility_notes,entry_fee_text,contact_phone,contact_note,level,age_group,hcp_min,hcp_max,"
        "event_status,registration_status,registration_deadline,registration_url,regulations_url,organizer,"
        "summary,source_id,source_url,source_excerpt,published,verified_at,last_checked_at"
    )
    placeholders = ",".join("?" for _ in columns.split(","))
    for event in events:
        values = [event.get(key) for key in (
            "id", "name", "sport", "start_date", "end_date", "country", "region", "city", "venue", "venue_address",
            "format", "eligibility_notes", "entry_fee_text", "contact_phone", "contact_note", "level",
            "age_group", "hcp_min", "hcp_max", "event_status", "registration_status", "registration_deadline",
            "registration_url", "regulations_url", "organizer", "summary", "source_id", "source_url",
            "source_excerpt", "published", "verified_at", "last_checked_at"
        )]
        values[29] = int(bool(values[29]))
        con.execute(f"INSERT OR IGNORE INTO tournaments ({columns}) VALUES ({placeholders})", values)
        evidence_rows = event.get("evidence") or [
            {"field_name": field, "field_value": str(event.get(field) or ""), "source_id": event.get("source_id"),
             "source_url": event.get("source_url"), "excerpt": event.get("source_excerpt"),
             "evidence_state": "observed"}
            for field in ("name", "start_date", "end_date", "venue")
        ]
        for item in evidence_rows:
            con.execute(
                """INSERT INTO event_evidence
                   (tournament_id, field_name, field_value, source_id, source_url, excerpt,
                    evidence_state, observed_at, verified_at)
                   SELECT ?, ?, ?, ?, ?, ?, ?, ?, NULL
                   WHERE NOT EXISTS (
                     SELECT 1 FROM event_evidence WHERE tournament_id=? AND field_name=? AND source_url=?
                   )""",
                (event["id"], item["field_name"], item["field_value"], item.get("source_id"),
                 item.get("source_url") or event.get("source_url"), item.get("excerpt"),
                 item.get("evidence_state", "observed"), event.get("last_checked_at") or "2026-11-19",
                 event["id"], item["field_name"], item.get("source_url") or event.get("source_url"))
            )


def _seed_clubs(con: sqlite3.Connection) -> None:
    clubs: list[dict[str, Any]] = json.loads((DATA_DIR / "clubs.seed.json").read_text(encoding="utf-8"))
    for club in clubs:
        con.execute(
            """INSERT OR IGNORE INTO clubs
               (id,name,country,region,city,address,website,phone,email,latitude,longitude,source_url,
                source_excerpt,evidence_state,checked_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (club["id"],club["name"],club["country"],club.get("region"),club.get("city"),club.get("address"),
             club.get("website"),club.get("phone"),club.get("email"),club.get("latitude"),club.get("longitude"),
             club.get("source_url"),club.get("source_excerpt"),club.get("evidence_state","unverified"),
             club.get("checked_at"))
        )


def rows_as_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]
