-- Demo number pool. Each row is a leased Twilio number permanently paired with one shop row in
-- voice-agent; assigning a demo rewrites that shop's name rather than creating or buying anything,
-- so a number is never orphaned — `inbound.ts` 404s on a number it cannot resolve to a shop.

CREATE TABLE IF NOT EXISTS demo_numbers (
  phone_e164  TEXT PRIMARY KEY,
  twilio_sid  TEXT NOT NULL,
  shop_id     TEXT NOT NULL,                  -- fixed shop row in voice-agent
  state       TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'assigned', 'grace')),
  lead_id     TEXT REFERENCES leads(id) ON DELETE SET NULL,
  lead_lang   TEXT,                           -- en | es
  assigned_at TEXT,
  expires_at  TEXT,                           -- assigned_at + TTL, when nobody has called yet
  grace_until TEXT,                           -- set once the owner calls: end of call + 1 h
  called_at   TEXT,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS demo_numbers_state ON demo_numbers (state, expires_at);

-- A double-clicked "Generate demo" must not lease a second number to the same lead.
CREATE UNIQUE INDEX IF NOT EXISTS demo_numbers_lead ON demo_numbers (lead_id) WHERE lead_id IS NOT NULL;

-- Survives the number being released and re-leased, so the panel keeps showing that this owner
-- actually dialled — the strongest buying signal we get.
ALTER TABLE lead_state ADD COLUMN demo_called_at TEXT;
