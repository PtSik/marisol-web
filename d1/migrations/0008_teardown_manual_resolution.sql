-- Preserve existing jobs while extending the status constraint.
CREATE TABLE teardown_jobs_next (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'resource')),
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'blocked', 'resolved')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  token TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  resolution_note TEXT
);
INSERT INTO teardown_jobs_next (id, kind, payload, status, attempts, next_attempt_at, lease_until, token, last_error, created_at, completed_at)
SELECT id, kind, payload, status, attempts, next_attempt_at, lease_until, token, last_error, created_at, completed_at FROM teardown_jobs;
DROP TABLE teardown_jobs;
ALTER TABLE teardown_jobs_next RENAME TO teardown_jobs;
CREATE INDEX teardown_jobs_due ON teardown_jobs(status, next_attempt_at, lease_until);
