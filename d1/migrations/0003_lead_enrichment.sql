-- What we managed to read off a lead's own website, so the demo can answer as their salon rather
-- than as a generic one.
--
-- Its own table rather than columns on `leads` because `leads` is replaced wholesale by every
-- scraper run (see the header of 0001_outreach.sql). Enrichment costs a fetch and an LLM call per
-- lead, so it has to survive a re-scrape the way `lead_state` does.
--
-- `services` holds ServiceEntry[] — {name, durationMin?, durationMaxMin?, price?, priceMax?} — not
-- the rendered strings. Formatting stays in `toShopServices`, so a change there (the " / " separator
-- landed in kaijiro-voice-landing#62) reformats every lead without re-scraping any of them.

CREATE TABLE IF NOT EXISTS lead_enrichment (
  lead_id            TEXT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  services           TEXT,                           -- JSON ServiceEntry[]
  service_confidence TEXT NOT NULL DEFAULT 'none',   -- high | low | none
  source_url         TEXT,
  fetched_at         TEXT NOT NULL,
  note               TEXT                            -- why it isn't `high`; shown to the rep in /sales
);

-- The enrichment runner walks leads by neighbourhood and skips anything fetched recently.
CREATE INDEX IF NOT EXISTS lead_enrichment_fetched ON lead_enrichment (fetched_at);
