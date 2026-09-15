-- Outreach call queue for the /sales panel. Facts about a lead live in `leads` and are replaced by
-- every scraper run; what the team did about a lead lives in `lead_state` and survives re-scrapes.

CREATE TABLE IF NOT EXISTS leads (
  id               TEXT PRIMARY KEY,             -- digits of the phone number, unique per shop
  shop_name        TEXT NOT NULL,
  phone_e164       TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  neighborhood     TEXT NOT NULL DEFAULT '',
  address          TEXT,
  hours            TEXT,                          -- raw Places text, parsed at render time
  rating           REAL,
  review_count     INTEGER NOT NULL DEFAULT 0,
  is_mobile        INTEGER NOT NULL DEFAULT 0,
  is_chain         INTEGER NOT NULL DEFAULT 0,
  booking_app      TEXT NOT NULL DEFAULT '',
  es_strength      TEXT NOT NULL DEFAULT 'none',  -- strong | weak | none
  prices           TEXT,                          -- scraped service prices, only when trustworthy
  price_confidence TEXT NOT NULL DEFAULT 'low',
  website          TEXT,
  instagram        TEXT,
  score            INTEGER NOT NULL DEFAULT 0,
  tier             TEXT NOT NULL DEFAULT 'C',     -- A | B | C | X
  imported_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_state (
  lead_id           TEXT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  outcome           TEXT NOT NULL DEFAULT 'new',
  attempts          INTEGER NOT NULL DEFAULT 0,
  owner             TEXT,
  last_contact_at   TEXT,
  next_followup     TEXT,                         -- YYYY-MM-DD
  note              TEXT,
  demo_lang         TEXT,                         -- en | es, the rep's choice
  demo_requested_at TEXT,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor      TEXT NOT NULL,
  outcome    TEXT,
  note       TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_queue        ON leads (tier, score DESC);
CREATE INDEX IF NOT EXISTS lead_state_outcome ON lead_state (outcome, next_followup);
CREATE INDEX IF NOT EXISTS lead_events_lead   ON lead_events (lead_id, created_at DESC);
