PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    country TEXT,
    source_type TEXT NOT NULL,
    authority TEXT NOT NULL CHECK (authority IN ('organizer', 'federation', 'club', 'aggregator', 'ranking', 'other')),
    collection_mode TEXT NOT NULL DEFAULT 'manual',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_attempt_at TEXT,
    last_success_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sport TEXT NOT NULL CHECK (sport IN ('golf', 'mini_golf', 'other')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    country TEXT NOT NULL,
    region TEXT,
    city TEXT,
    venue TEXT,
    venue_address TEXT,
    format TEXT,
    eligibility_notes TEXT,
    entry_fee_text TEXT,
    contact_phone TEXT,
    contact_note TEXT,
    level TEXT,
    age_group TEXT,
    hcp_min REAL,
    hcp_max REAL,
    event_status TEXT NOT NULL DEFAULT 'unknown' CHECK (event_status IN ('scheduled', 'postponed', 'cancelled', 'completed', 'unknown')),
    registration_status TEXT NOT NULL DEFAULT 'unknown' CHECK (registration_status IN ('open', 'closed', 'not_required', 'unknown')),
    registration_deadline TEXT,
    registration_url TEXT,
    regulations_url TEXT,
    organizer TEXT,
    summary TEXT,
    source_id TEXT REFERENCES sources(id),
    source_url TEXT,
    source_excerpt TEXT,
    published INTEGER NOT NULL DEFAULT 0,
    verified_at TEXT,
    last_checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date),
    CHECK (hcp_min IS NULL OR hcp_max IS NULL OR hcp_max >= hcp_min)
);

CREATE TABLE IF NOT EXISTS event_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_value TEXT NOT NULL,
    source_id TEXT REFERENCES sources(id),
    source_url TEXT NOT NULL,
    excerpt TEXT,
    evidence_state TEXT NOT NULL DEFAULT 'observed' CHECK (evidence_state IN ('observed', 'verified', 'conflict', 'rejected')),
    observed_at TEXT NOT NULL,
    verified_at TEXT
);

CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    participant_name TEXT NOT NULL,
    category TEXT,
    place INTEGER,
    gross_score TEXT,
    net_score TEXT,
    stableford_points INTEGER,
    round_scores_json TEXT NOT NULL DEFAULT '[]',
    is_official INTEGER NOT NULL DEFAULT 0,
    source_url TEXT,
    source_excerpt TEXT,
    verified_at TEXT
);

CREATE TABLE IF NOT EXISTS clubs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    region TEXT,
    city TEXT,
    address TEXT,
    website TEXT,
    phone TEXT,
    email TEXT,
    latitude REAL,
    longitude REAL,
    source_url TEXT,
    source_excerpt TEXT,
    evidence_state TEXT NOT NULL DEFAULT 'unverified' CHECK (evidence_state IN ('verified', 'unverified', 'stale')),
    checked_at TEXT
);

CREATE TABLE IF NOT EXISTS organizer_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    sport TEXT NOT NULL DEFAULT 'golf' CHECK (sport IN ('golf', 'mini_golf', 'other')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    country TEXT NOT NULL,
    region TEXT,
    venue TEXT,
    venue_address TEXT,
    format TEXT,
    eligibility_notes TEXT,
    entry_fee_text TEXT,
    contact_phone TEXT,
    contact_note TEXT,
    organizer TEXT,
    level TEXT,
    age_group TEXT,
    hcp_min REAL,
    hcp_max REAL,
    registration_url TEXT,
    regulations_url TEXT,
    source_url TEXT NOT NULL,
    notes TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS correction_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    suggested_value TEXT NOT NULL,
    evidence_url TEXT,
    notes TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    source_url TEXT,
    reviewed_at TEXT NOT NULL,
    reviewer TEXT NOT NULL DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS source_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL REFERENCES sources(id),
    checked_at TEXT NOT NULL,
    http_status INTEGER,
    content_hash TEXT,
    page_title TEXT,
    changed INTEGER NOT NULL DEFAULT 0,
    error TEXT
);

CREATE TABLE IF NOT EXISTS source_review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL REFERENCES sources(id),
    snapshot_id INTEGER REFERENCES source_snapshots(id),
    detected_at TEXT NOT NULL,
    reason TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS tournaments_date_idx ON tournaments(start_date, end_date);
CREATE INDEX IF NOT EXISTS tournaments_region_idx ON tournaments(country, region, city);
CREATE INDEX IF NOT EXISTS results_tournament_idx ON results(tournament_id, place);
CREATE INDEX IF NOT EXISTS evidence_tournament_idx ON event_evidence(tournament_id, field_name);
CREATE INDEX IF NOT EXISTS submission_status_idx ON organizer_submissions(review_status, created_at);
