"""Pure domain rules: keep these independent of HTTP and database code."""
from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from typing import Any

try:  # В slim-образах и Alpine может не быть tzdata.
    from zoneinfo import ZoneInfo
    MOSCOW_TZ = ZoneInfo("Europe/Moscow")
except Exception:  # pragma: no cover - зависит от окружения
    MOSCOW_TZ = timezone(timedelta(hours=3))  # MSK без перехода на летнее время


def today_moscow() -> date:
    return datetime.now(MOSCOW_TZ).date()


def display_status(event: dict[str, Any], today: date | None = None) -> str:
    """Return a UI status without inventing completion/cancellation facts."""
    today = today or today_moscow()
    state = (event.get("event_status") or "unknown").casefold()
    if state in {"cancelled", "postponed", "completed"}:
        return state
    try:
        start = date.fromisoformat(str(event["start_date"])[:10])
        end = date.fromisoformat(str(event["end_date"])[:10])
    except (KeyError, TypeError, ValueError):
        return "date_unverified"
    if end < today:
        return "date_elapsed_status_unconfirmed"
    if start <= today <= end:
        return "within_scheduled_dates_status_unconfirmed"
    if state == "scheduled":
        return "scheduled"
    return "status_unconfirmed"


def is_eligible(event: dict[str, Any], handicap: float | None = None,
                age_group: str | None = None) -> bool:
    """A missing restriction is not a rejection; unknown eligibility stays visible."""
    event_age = event.get("age_group")
    aliases = {
        "open": {"open", "all", "все", "любой возраст"},
        "adult": {"adult", "adults", "взрослые", "взрослый", "19+"},
        "junior": {"junior", "juniors", "юниоры", "юниор", "дети"},
    }
    def group_key(value: str) -> str:
        folded = value.casefold().strip()
        for key, values in aliases.items():
            if folded in values:
                return key
        return folded
    if age_group and event_age and group_key(event_age) not in {"open", group_key(age_group)}:
        return False
    low, high = event.get("hcp_min"), event.get("hcp_max")
    if handicap is not None:
        if low is not None and handicap < float(low):
            return False
        if high is not None and handicap > float(high):
            return False
    return True


def freshness_status(event: dict[str, Any], today: date | None = None) -> str:
    """Surface stale checks instead of making old observations look live."""
    today = today or today_moscow()
    checked_raw = event.get("last_checked_at")
    checked = date.fromisoformat(str(checked_raw)[:10]) if checked_raw else None
    if checked is None:
        return "never_checked"
    end = date.fromisoformat(str(event.get("end_date"))[:10])
    if end < today:
        return "historical"
    start = date.fromisoformat(str(event.get("start_date"))[:10])
    days_until_start = (start - today).days
    max_age_days = 3 if days_until_start <= 14 else 14
    age_days = max(0, (today - checked).days)
    return "stale" if age_days > max_age_days else "fresh"


def event_to_public(row: dict[str, Any], today: date | None = None) -> dict[str, Any]:
    result = dict(row)
    result["display_status"] = display_status(result, today)
    try:
        result["freshness_state"] = freshness_status(result, today)
    except (TypeError, ValueError):
        result["freshness_state"] = "date_unverified"
    notes = (result.get("eligibility_notes") or "").casefold()
    has_unstructured_hcp = ("hcp" in notes or "гандикап" in notes) and result.get("hcp_min") is None and result.get("hcp_max") is None
    has_unstructured_minimum_age = any(token in notes for token in ("от 19", "19 лет", "19+"))
    result["eligibility_state"] = "check_regulations" if (has_unstructured_hcp or has_unstructured_minimum_age) else ("described" if notes else "unknown")
    result["published"] = bool(result.get("published"))
    return result
