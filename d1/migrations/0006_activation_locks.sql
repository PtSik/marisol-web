-- A KV read/write pair cannot prevent two admin requests from provisioning the same lead at once.
-- D1's primary-key constraint makes the claim atomic. Completed and uncertain attempts deliberately
-- keep their row; only a fully rolled-back failure releases it for an explicit retry.
CREATE TABLE IF NOT EXISTS activation_locks (
  lead_id     TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  acquired_at TEXT NOT NULL
);
