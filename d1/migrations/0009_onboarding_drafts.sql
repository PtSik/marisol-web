-- Account-owned drafts; conditional revisions prevent cross-tab lost updates.
CREATE TABLE IF NOT EXISTS onboarding_drafts (
  account_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
