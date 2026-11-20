from __future__ import annotations
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
import json
import os
import sqlite3
import secrets
import uuid
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from .db import db_session, init_database, rows_as_dicts
from .domain import display_status, event_to_public, is_eligible, today_moscow
from .models import AdminClub, AdminDecision, AdminResult, CorrectionReport, OrganizerSubmission

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    yield


app = FastAPI(
    title="Мир Гольфа API",
    description=(
        "Календарь турниров, источники, клубы, результаты и заявки организаторов. "
        "Неподтверждённые данные не выдаются за официальные."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

allowed_origins = os.getenv("GOLF_CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _row_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _get_event(con: sqlite3.Connection, event_id: str) -> dict[str, Any] | None:
    return _row_dict(con.execute(
        """SELECT t.*, s.name AS source_name, s.authority AS source_authority
           FROM tournaments t LEFT JOIN sources s ON s.id=t.source_id
           WHERE t.id=? AND t.published=1""", (event_id,)
    ).fetchone())


def _parse_iso_day(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _select_events(
    *, q: str | None = None, country: str | None = None, region: str | None = None,
    sport: str | None = None, level: str | None = None, age_group: str | None = None,
    start_from: date | None = None, end_to: date | None = None, ended_before: date | None = None,
    registration_open: bool | None = None, handicap: float | None = None,
    limit: int = 50, offset: int = 0,
) -> list[dict[str, Any]]:
    with db_session() as con:
        raw = rows_as_dicts(con.execute(
            """SELECT t.*, s.name AS source_name, s.authority AS source_authority
               FROM tournaments t LEFT JOIN sources s ON s.id=t.source_id
               WHERE t.published=1 ORDER BY t.start_date ASC, t.name ASC"""
        ).fetchall())
    needle = (q or "").strip().casefold()
    found: list[dict[str, Any]] = []
    for event in raw:
        if needle and needle not in " ".join(str(event.get(k) or "") for k in ("name", "venue", "city", "region", "organizer", "country")).casefold():
            continue
        if country and country.casefold() not in (event.get("country") or "").casefold():
            continue
        if region and region.casefold() not in (event.get("region") or "").casefold():
            continue
        if sport and sport != "all" and event.get("sport") != sport:
            continue
        if level and level.casefold() not in (event.get("level") or "").casefold():
            continue
        if start_from and (_parse_iso_day(event.get("end_date")) or date.min) < start_from:
            continue
        if end_to and (_parse_iso_day(event.get("start_date")) or date.max) > end_to:
            continue
        if ended_before and (_parse_iso_day(event.get("end_date")) or date.max) >= ended_before:
            continue
        if registration_open is True and event.get("registration_status") != "open":
            continue
        if registration_open is False and event.get("registration_status") == "open":
            continue
        if age_group or handicap is not None:
            if not is_eligible(event, handicap=handicap, age_group=age_group):
                continue
        found.append(event_to_public(event))
    return found[offset:offset + limit]


@app.get(f"{API_PREFIX}/health")
def health():
    return {"status": "ok", "service": "mir-golfa-api", "mode": "starter"}


@app.get(f"{API_PREFIX}/tournaments")
def list_tournaments(
    q: str | None = None,
    country: str | None = None,
    region: str | None = None,
    sport: str | None = None,
    level: str | None = None,
    age_group: str | None = None,
    start_from: date | None = None,
    end_to: date | None = None,
    ended_before: date | None = None,
    registration_open: bool | None = None,
    handicap: float | None = Query(default=None, ge=0, le=54),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items = _select_events(
        q=q, country=country, region=region, sport=sport, level=level, age_group=age_group,
        start_from=start_from, end_to=end_to, ended_before=ended_before,
        registration_open=registration_open, handicap=handicap, limit=limit, offset=offset,
    )
    return {"items": items, "count": len(items), "limit": limit, "offset": offset}


@app.get(f"{API_PREFIX}/tournaments/{{event_id}}")
def tournament_detail(event_id: str):
    with db_session() as con:
        event = _get_event(con, event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Турнир не найден")
        evidence = rows_as_dicts(con.execute(
            """SELECT field_name, field_value, source_id, source_url, excerpt,
                      evidence_state, observed_at, verified_at
               FROM event_evidence WHERE tournament_id=? ORDER BY observed_at DESC""",
            (event_id,)
        ).fetchall())
    result = event_to_public(event)
    result["evidence"] = evidence
    return result


@app.get(f"{API_PREFIX}/tournaments/{{event_id}}/history")
def tournament_history(event_id: str):
    with db_session() as con:
        if not _get_event(con, event_id):
            raise HTTPException(status_code=404, detail="Турнир не найден")
        items = rows_as_dicts(con.execute(
            "SELECT field_name,old_value,new_value,source_url,reviewed_at,reviewer FROM event_change_log WHERE tournament_id=? ORDER BY reviewed_at DESC",
            (event_id,)
        ).fetchall())
    return {"items": items, "count": len(items)}


@app.get(f"{API_PREFIX}/tournaments/{{event_id}}/results")
def tournament_results(event_id: str):
    with db_session() as con:
        if not _get_event(con, event_id):
            raise HTTPException(status_code=404, detail="Турнир не найден")
        rows = rows_as_dicts(con.execute(
            """SELECT participant_name, category, place, gross_score, net_score,
                      stableford_points, round_scores_json, is_official, source_url, verified_at
               FROM results WHERE tournament_id=? AND is_official=1 AND verified_at IS NOT NULL
               ORDER BY place ASC""",
            (event_id,)
        ).fetchall())
    for row in rows:
        row["round_scores"] = json.loads(row.pop("round_scores_json") or "[]")
        row["is_official"] = bool(row["is_official"])
    return {"items": rows, "count": len(rows), "verified_only": True}


@app.get(f"{API_PREFIX}/results")
def all_verified_results(limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0)):
    with db_session() as con:
        rows = rows_as_dicts(con.execute(
            """SELECT r.participant_name, r.category, r.place, r.gross_score, r.net_score,
                      r.stableford_points, r.round_scores_json, r.source_url, r.verified_at,
                      t.id AS tournament_id, t.name AS tournament_name, t.start_date
               FROM results r JOIN tournaments t ON t.id=r.tournament_id
               WHERE r.is_official=1 AND r.verified_at IS NOT NULL AND t.published=1
               ORDER BY t.start_date DESC, r.place ASC LIMIT ? OFFSET ?""",
            (limit, offset)
        ).fetchall())
    for row in rows:
        row["round_scores"] = json.loads(row.pop("round_scores_json") or "[]")
    return {"items": rows, "count": len(rows), "verified_only": True}


@app.get(f"{API_PREFIX}/sources")
def list_sources(country: str | None = None, enabled_only: bool = True):
    sql = ("SELECT id, name, url, country, region, source_type, authority, collection_mode, enabled, "
           "notes, verification_status, last_attempt_at, last_success_at, last_error FROM sources")
    params: list[Any] = []
    clauses: list[str] = []
    if enabled_only:
        clauses.append("enabled=1")
    if country:
        clauses.append("country LIKE ?")
        params.append(f"%{country}%")
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY country, name"
    with db_session() as con:
        rows = rows_as_dicts(con.execute(sql, params).fetchall())
    for row in rows:
        row["enabled"] = bool(row["enabled"])
    return {"items": rows, "count": len(rows)}


@app.get(f"{API_PREFIX}/clubs")
def list_clubs(q: str | None = None, region: str | None = None, limit: int = Query(default=50, ge=1, le=100)):
    sql = "SELECT id, name, country, region, city, address, website, phone, email, latitude, longitude, source_url, source_excerpt, evidence_state, checked_at FROM clubs"
    params: list[Any] = []
    clauses: list[str] = ["evidence_state='verified'"]
    if q:
        clauses.append("(name LIKE ? OR city LIKE ? OR region LIKE ?)")
        params.extend([f"%{q}%"] * 3)
    if region:
        clauses.append("region LIKE ?")
        params.append(f"%{region}%")
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY country, region, name LIMIT ?"
    params.append(limit)
    with db_session() as con:
        rows = rows_as_dicts(con.execute(sql, params).fetchall())
    return {"items": rows, "count": len(rows)}


@app.get(f"{API_PREFIX}/stats/overview")
def stats_overview():
    with db_session() as con:
        events = rows_as_dicts(con.execute("SELECT * FROM tournaments WHERE published=1").fetchall())
        source_count = con.execute("SELECT COUNT(*) FROM sources WHERE enabled=1").fetchone()[0]
        club_count = con.execute("SELECT COUNT(*) FROM clubs WHERE evidence_state='verified'").fetchone()[0]
        result_count = con.execute("SELECT COUNT(*) FROM results WHERE is_official=1 AND verified_at IS NOT NULL").fetchone()[0]
    today = today_moscow()
    upcoming = sum(1 for e in events if (_parse_iso_day(e.get("end_date")) or date.min) >= today
                   and e.get("event_status") not in {"cancelled", "completed"})
    regions: dict[str, int] = {}
    sports: dict[str, int] = {}
    for event in events:
        key = event.get("region") or "Регион не указан"
        regions[key] = regions.get(key, 0) + 1
        sports[event["sport"]] = sports.get(event["sport"], 0) + 1
    return {
        "published_events": len(events), "upcoming_events": upcoming,
        "verified_results": result_count, "verified_clubs": club_count,
        "enabled_sources": source_count, "events_by_region": regions, "events_by_sport": sports,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Показатели отражают только записи базы, а не полноту всего рынка."
    }


@app.get(f"{API_PREFIX}/recommendations")
def recommendations(
    region: str | None = None,
    sport: str | None = None,
    age_group: str | None = None,
    handicap: float | None = Query(default=None, ge=0, le=54),
    limit: int = Query(default=20, ge=1, le=50),
):
    items = _select_events(
        region=region, sport=sport, age_group=age_group, handicap=handicap,
        start_from=today_moscow(), limit=100,
    )
    for item in items:
        notes = (item.get("eligibility_notes") or "").casefold()
        structured_hcp = item.get("hcp_min") is not None or item.get("hcp_max") is not None
        has_hcp_rules = "hcp" in notes or "гандикап" in notes
        has_minimum_age = any(token in notes for token in ("от 19", "19 лет", "19+"))
        item["eligibility_match"] = "check_regulations" if (
            (has_hcp_rules and not structured_hcp) or has_minimum_age
        ) else "matches_known_constraints"
    # Unknown constraints remain visible with a warning; they are never presented as a guaranteed fit.
    items.sort(key=lambda e: (e["registration_status"] != "open", e["start_date"], e["name"]))
    return {"items": items[:limit], "count": min(len(items), limit), "personalized": bool(region or sport or age_group or handicap is not None)}


def _ics_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


@app.get(f"{API_PREFIX}/calendar.ics")
def calendar_ics(region: str | None = None):
    items = _select_events(region=region, start_from=today_moscow(), limit=100)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mir Golfa//RU", "CALSCALE:GREGORIAN"]
    for event in items:
        start = event["start_date"].replace("-", "")
        end_day = _parse_iso_day(event["end_date"])
        end = (date.fromordinal(end_day.toordinal() + 1).isoformat() if end_day else event["end_date"]).replace("-", "")
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{_ics_escape(event['id'])}@mir-golfa",
            f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
            f"DTSTART;VALUE=DATE:{start}",
            f"DTEND;VALUE=DATE:{end}",
            f"SUMMARY:{_ics_escape(event['name'])}",
            f"LOCATION:{_ics_escape(', '.join(str(event.get(k)) for k in ('venue','city','region') if event.get(k)))}",
            f"URL:{event.get('source_url') or ''}",
            "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return Response("\r\n".join(lines) + "\r\n", media_type="text/calendar; charset=utf-8")


@app.post(f"{API_PREFIX}/organizer/submissions", status_code=202)
def submit_event(payload: OrganizerSubmission):
    with db_session() as con:
        cursor = con.execute(
            """INSERT INTO organizer_submissions
               (event_name,sport,start_date,end_date,country,region,venue,venue_address,format,eligibility_notes,
                entry_fee_text,contact_phone,contact_note,organizer,level,age_group,hcp_min,hcp_max,
                registration_url,regulations_url,source_url,notes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (payload.event_name, payload.sport, payload.start_date.isoformat(), payload.end_date.isoformat(),
             payload.country, payload.region, payload.venue, payload.venue_address, payload.format,
             payload.eligibility_notes, payload.entry_fee_text, payload.contact_phone, payload.contact_note,
             payload.organizer, payload.level, payload.age_group, payload.hcp_min, payload.hcp_max,
             str(payload.registration_url) if payload.registration_url else None,
             str(payload.regulations_url) if payload.regulations_url else None,
             str(payload.source_url), payload.notes)
        )
        submission_id = cursor.lastrowid
    return {"id": submission_id, "review_status": "pending", "message": "Заявка получена и ждёт проверки редактором."}


@app.post(f"{API_PREFIX}/tournaments/{{event_id}}/corrections", status_code=202)
def report_correction(event_id: str, payload: CorrectionReport):
    with db_session() as con:
        if not _get_event(con, event_id):
            raise HTTPException(status_code=404, detail="Турнир не найден")
        cursor = con.execute(
            """INSERT INTO correction_reports
               (tournament_id,field_name,suggested_value,evidence_url,notes)
               VALUES (?,?,?,?,?)""",
            (event_id, payload.field_name, payload.suggested_value,
             str(payload.evidence_url) if payload.evidence_url else None, payload.notes)
        )
        report_id = cursor.lastrowid
    return {"id": report_id, "review_status": "pending", "message": "Исправление принято на проверку."}


# Moderation is disabled unless an explicit server-side secret is configured.
def _require_admin(token: str | None) -> str:
    expected = os.getenv("GOLF_ADMIN_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="Админские операции отключены: задайте GOLF_ADMIN_TOKEN")
    if not token or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Неверный токен администратора")
    return "admin"


@app.get(f"{API_PREFIX}/admin/submissions")
def admin_submissions(status: str = "pending", x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    if status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Недопустимый статус")
    with db_session() as con:
        items = rows_as_dicts(con.execute(
            "SELECT * FROM organizer_submissions WHERE review_status=? ORDER BY created_at ASC LIMIT 200",
            (status,)
        ).fetchall())
    return {"items": items, "count": len(items)}


@app.post(f"{API_PREFIX}/admin/submissions/{{submission_id}}/approve")
def approve_submission(submission_id: int, decision: AdminDecision | None = None,
                       x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    now = datetime.now(timezone.utc).isoformat()
    with db_session() as con:
        submission = con.execute(
            "SELECT * FROM organizer_submissions WHERE id=? AND review_status='pending'",
            (submission_id,)
        ).fetchone()
        if not submission:
            raise HTTPException(status_code=404, detail="Заявка не найдена или уже обработана")
        row = dict(submission)
        event_id = f"community-{uuid.uuid4().hex[:12]}"
        con.execute(
            """INSERT INTO tournaments
               (id,name,sport,start_date,end_date,country,region,venue,venue_address,format,eligibility_notes,
                entry_fee_text,contact_phone,contact_note,level,age_group,hcp_min,hcp_max,event_status,
                registration_status,registration_url,regulations_url,organizer,summary,source_url,source_excerpt,
                published,verified_at,last_checked_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)""",
            (event_id,row['event_name'],row['sport'],row['start_date'],row['end_date'],row['country'],
             row['region'],row['venue'],row['venue_address'],row['format'],row['eligibility_notes'],
             row['entry_fee_text'],row['contact_phone'],row['contact_note'],row['level'],row['age_group'],
             row['hcp_min'],row['hcp_max'],'scheduled','unknown',row['registration_url'],row['regulations_url'],
             row['organizer'],None,row['source_url'],decision.verified_excerpt if decision and decision.verified_excerpt else None,now,now)
        )
        con.execute(
            """INSERT INTO event_evidence
               (tournament_id,field_name,field_value,source_url,excerpt,evidence_state,observed_at,verified_at)
               VALUES(?,?,?,?,?,'verified',?,?)""",
            (event_id,'organizer_submission',row['event_name'],row['source_url'],
             decision.verified_excerpt if decision else None,now,now)
        )
        con.execute("UPDATE organizer_submissions SET review_status='approved' WHERE id=?",(submission_id,))
    return {"id":event_id,"review_status":"published","message":"Событие опубликовано после проверки."}


@app.post(f"{API_PREFIX}/admin/submissions/{{submission_id}}/reject")
def reject_submission(submission_id: int, decision: AdminDecision | None = None,
                      x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    with db_session() as con:
        cursor=con.execute("UPDATE organizer_submissions SET review_status='rejected' WHERE id=? AND review_status='pending'",(submission_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Заявка не найдена или уже обработана")
    return {"id":submission_id,"review_status":"rejected","notes":decision.notes if decision else None}


@app.get(f"{API_PREFIX}/admin/corrections")
def admin_corrections(status: str = "pending", x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    if status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Недопустимый статус")
    with db_session() as con:
        items=rows_as_dicts(con.execute(
            "SELECT * FROM correction_reports WHERE review_status=? ORDER BY created_at ASC LIMIT 200",(status,)
        ).fetchall())
    return {"items":items,"count":len(items)}


@app.post(f"{API_PREFIX}/admin/corrections/{{report_id}}/approve")
def approve_correction(report_id: int, decision: AdminDecision | None = None,
                       x_admin_token: str | None = Header(default=None)):
    reviewer=_require_admin(x_admin_token)
    editable={"name","start_date","end_date","venue","city","region","level","age_group",
              "registration_status","registration_deadline","registration_url","regulations_url","organizer"}
    now=datetime.now(timezone.utc).isoformat()
    with db_session() as con:
        report=con.execute("SELECT * FROM correction_reports WHERE id=? AND review_status='pending'",(report_id,)).fetchone()
        if not report:
            raise HTTPException(status_code=404,detail="Исправление не найдено или уже обработано")
        r=dict(report); field=r['field_name']; value=r['suggested_value']
        if field not in editable:
            raise HTTPException(status_code=400,detail="Это поле нельзя менять через публичную форму")
        event=con.execute("SELECT * FROM tournaments WHERE id=?",(r['tournament_id'],)).fetchone()
        if not event:
            raise HTTPException(status_code=404,detail="Турнир не найден")
        old=event[field]
        if field in {"start_date","end_date","registration_deadline"}:
            try: date.fromisoformat(value)
            except ValueError: raise HTTPException(status_code=400,detail="Дата должна быть в формате YYYY-MM-DD")
        if field == "registration_status" and value not in {"open","closed","not_required","unknown"}:
            raise HTTPException(status_code=400,detail="Недопустимый статус регистрации")
        if field in {"registration_url","regulations_url"}:
            from urllib.parse import urlparse
            parsed=urlparse(value)
            if parsed.scheme not in {"http","https"} or not parsed.netloc:
                raise HTTPException(status_code=400,detail="Нужна корректная ссылка http/https")
        if field == "name" and len(value.strip()) < 3:
            raise HTTPException(status_code=400,detail="Название слишком короткое")
        if field in {"start_date","end_date"}:
            start=value if field=="start_date" else event['start_date']
            end=value if field=="end_date" else event['end_date']
            if end < start: raise HTTPException(status_code=400,detail="Окончание не может быть раньше начала")
        # field is restricted to the fixed allowlist above.
        con.execute(f"UPDATE tournaments SET {field}=?,updated_at=?,verified_at=?,last_checked_at=? WHERE id=?",
                    (value,now,now,now,r['tournament_id']))
        con.execute("""INSERT INTO event_change_log(tournament_id,field_name,old_value,new_value,source_url,reviewed_at,reviewer)
                       VALUES(?,?,?,?,?,?,?)""",
                    (r['tournament_id'],field,str(old) if old is not None else None,value,r['evidence_url'],now,reviewer))
        con.execute("""INSERT INTO event_evidence(tournament_id,field_name,field_value,source_url,excerpt,evidence_state,observed_at,verified_at)
                       VALUES(?,?,?,?,?,'verified',?,?)""",
                    (r['tournament_id'],field,value,r['evidence_url'] or event['source_url'],
                     decision.verified_excerpt if decision else None,now,now))
        con.execute("UPDATE correction_reports SET review_status='approved' WHERE id=?",(report_id,))
    return {"id":report_id,"review_status":"approved","message":"Исправление применено с записью в журнал аудита."}


@app.post(f"{API_PREFIX}/admin/corrections/{{report_id}}/reject")
def reject_correction(report_id: int, decision: AdminDecision | None = None,
                      x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    with db_session() as con:
        cursor=con.execute("UPDATE correction_reports SET review_status='rejected' WHERE id=? AND review_status='pending'",(report_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404,detail="Исправление не найдено или уже обработано")
    return {"id":report_id,"review_status":"rejected","notes":decision.notes if decision else None}


@app.get(f"{API_PREFIX}/admin/source-changes")
def admin_source_changes(status: str = "pending", x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    if status not in {"pending", "reviewed", "dismissed"}:
        raise HTTPException(status_code=400, detail="Недопустимый статус")
    with db_session() as con:
        items=rows_as_dicts(con.execute(
            """SELECT q.id,q.source_id,s.name AS source_name,s.url,q.detected_at,q.reason,q.review_status,
                      snap.page_title,snap.http_status,snap.content_hash
               FROM source_review_queue q JOIN sources s ON s.id=q.source_id
               LEFT JOIN source_snapshots snap ON snap.id=q.snapshot_id
               WHERE q.review_status=? ORDER BY q.detected_at DESC LIMIT 200""",(status,)
        ).fetchall())
    return {"items":items,"count":len(items)}


@app.post(f"{API_PREFIX}/admin/source-changes/{{change_id}}/review")
def review_source_change(change_id: int, decision: AdminDecision | None = None,
                         x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    with db_session() as con:
        cursor=con.execute("UPDATE source_review_queue SET review_status='reviewed' WHERE id=? AND review_status='pending'",(change_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404,detail="Изменение не найдено или уже проверено")
    return {"id":change_id,"review_status":"reviewed","notes":decision.notes if decision else None}


@app.post(f"{API_PREFIX}/admin/clubs", status_code=201)
def create_verified_club(payload: AdminClub, x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    now = datetime.now(timezone.utc).isoformat()
    club_id = payload.id or f"club-{uuid.uuid4().hex[:12]}"
    with db_session() as con:
        try:
            con.execute(
                """INSERT INTO clubs(id,name,country,region,city,address,website,phone,email,latitude,longitude,
                   source_url,source_excerpt,evidence_state,checked_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (club_id,payload.name,payload.country,payload.region,payload.city,payload.address,
                 str(payload.website) if payload.website else None,payload.phone,payload.email,
                 payload.latitude,payload.longitude,str(payload.source_url),payload.verified_excerpt,'verified',now)
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409,detail="Клуб с таким ID уже существует") from exc
    return {"id":club_id,"evidence_state":"verified","checked_at":now,
            "message":"Проверенная карточка клуба создана."}


@app.post(f"{API_PREFIX}/admin/tournaments/{{event_id}}/results", status_code=201)
def create_verified_result(event_id: str, payload: AdminResult,
                           x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    now=datetime.now(timezone.utc).isoformat()
    with db_session() as con:
        if not _get_event(con,event_id):
            raise HTTPException(status_code=404,detail="Турнир не найден")
        duplicate=con.execute(
            "SELECT id FROM results WHERE tournament_id=? AND participant_name=? AND COALESCE(category,'')=COALESCE(?,'')",
            (event_id,payload.participant_name,payload.category)
        ).fetchone()
        if duplicate:
            raise HTTPException(status_code=409,detail="Результат этого участника и категории уже внесён")
        cursor=con.execute(
            """INSERT INTO results(tournament_id,participant_name,category,place,gross_score,net_score,
               stableford_points,round_scores_json,is_official,source_url,source_excerpt,verified_at)
               VALUES(?,?,?,?,?,?,?, ?,1,?,?,?)""",
            (event_id,payload.participant_name,payload.category,payload.place,payload.gross_score,
             payload.net_score,payload.stableford_points,json.dumps(payload.round_scores,ensure_ascii=False),
             str(payload.source_url),payload.verified_excerpt,now)
        )
        result_id=cursor.lastrowid
    return {"id":result_id,"is_official":True,"verified_at":now,
            "message":"Результат сохранён как официальный."}
