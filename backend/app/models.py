from __future__ import annotations
from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, HttpUrl, model_validator

Sport = Literal["golf", "mini_golf", "other"]


class OrganizerSubmission(BaseModel):
    event_name: str = Field(min_length=3, max_length=200)
    start_date: date
    end_date: date
    country: str = Field(min_length=2, max_length=80)
    region: str | None = Field(default=None, max_length=100)
    venue: str | None = Field(default=None, max_length=180)
    venue_address: str | None = Field(default=None, max_length=250)
    format: str | None = Field(default=None, max_length=300)
    eligibility_notes: str | None = Field(default=None, max_length=1000)
    entry_fee_text: str | None = Field(default=None, max_length=300)
    contact_phone: str | None = Field(default=None, max_length=80)
    contact_note: str | None = Field(default=None, max_length=500)
    organizer: str | None = Field(default=None, max_length=180)
    source_url: HttpUrl
    sport: Sport = "golf"
    level: str | None = Field(default=None, max_length=100)
    age_group: str | None = Field(default=None, max_length=100)
    hcp_min: float | None = Field(default=None, ge=0, le=54)
    hcp_max: float | None = Field(default=None, ge=0, le=54)
    registration_url: HttpUrl | None = None
    regulations_url: HttpUrl | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def date_range_is_valid(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date не может быть раньше start_date")
        if self.hcp_min is not None and self.hcp_max is not None and self.hcp_max < self.hcp_min:
            raise ValueError("hcp_max не может быть меньше hcp_min")
        return self


class CorrectionReport(BaseModel):
    field_name: str = Field(min_length=2, max_length=80)
    suggested_value: str = Field(min_length=1, max_length=500)
    evidence_url: HttpUrl | None = None
    notes: str | None = Field(default=None, max_length=2000)


class TournamentOut(BaseModel):
    id: str
    name: str
    sport: Sport
    start_date: date
    end_date: date
    country: str
    region: str | None = None
    city: str | None = None
    venue: str | None = None
    venue_address: str | None = None
    format: str | None = None
    eligibility_notes: str | None = None
    entry_fee_text: str | None = None
    contact_phone: str | None = None
    contact_note: str | None = None
    level: str | None = None
    age_group: str | None = None
    hcp_min: float | None = None
    hcp_max: float | None = None
    event_status: str
    display_status: str
    freshness_state: str
    eligibility_state: str
    registration_status: str
    registration_deadline: date | None = None
    registration_url: str | None = None
    regulations_url: str | None = None
    organizer: str | None = None
    summary: str | None = None
    source_id: str | None = None
    source_url: str | None = None
    source_excerpt: str | None = None
    verified_at: str | None = None
    last_checked_at: str | None = None


class ApiMessage(BaseModel):
    message: str
    id: int | str | None = None


class AdminDecision(BaseModel):
    notes: str | None = Field(default=None, max_length=1000)
    verified_excerpt: str | None = Field(default=None, max_length=2000)

class AdminClub(BaseModel):
    id: str | None = Field(default=None, min_length=3, max_length=100)
    name: str = Field(min_length=2, max_length=180)
    country: str = Field(min_length=2, max_length=80)
    region: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=250)
    website: HttpUrl | None = None
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=160)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    source_url: HttpUrl
    verified_excerpt: str | None = Field(default=None, max_length=2000)


class AdminResult(BaseModel):
    participant_name: str = Field(min_length=2, max_length=180)
    category: str | None = Field(default=None, max_length=100)
    place: int | None = Field(default=None, ge=1)
    gross_score: str | None = Field(default=None, max_length=40)
    net_score: str | None = Field(default=None, max_length=40)
    stableford_points: int | None = Field(default=None, ge=0, le=200)
    round_scores: list[str] = Field(default_factory=list, max_length=10)
    source_url: HttpUrl
    verified_excerpt: str | None = Field(default=None, max_length=2000)
