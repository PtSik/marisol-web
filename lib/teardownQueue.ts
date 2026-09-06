export interface TeardownJob {
  id: string;
  kind: "subscription" | "resource";
  payload: string;
  status: "pending" | "running" | "complete" | "blocked" | "resolved";
  attempts: number;
  token: string;
  last_error: string | null;
  next_attempt_at: number;
}

export function teardownDb(db: D1Database | undefined): D1Database {
  if (!db) throw new Error("OUTREACH_DB is required for durable teardown");
  return db;
}

// Never replace a captured resource identity or revive a completed job on webhook replay.
export async function enqueueTeardown(
  db: D1Database | undefined,
  id: string,
  kind: TeardownJob["kind"],
  payload: unknown,
): Promise<void> {
  await teardownDb(db)
    .prepare(
      "INSERT OR IGNORE INTO teardown_jobs (id, kind, payload, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(id, kind, JSON.stringify(payload), Date.now())
    .run();
}

export async function claimTeardown(db: D1Database, now = Date.now()): Promise<TeardownJob | null> {
  return db
    .prepare(`UPDATE teardown_jobs SET status = 'running', token = ?, lease_until = ?, attempts = attempts + 1
    WHERE id = (SELECT id FROM teardown_jobs WHERE
      (status = 'pending' AND next_attempt_at <= ?) OR (status = 'running' AND lease_until <= ?)
      ORDER BY created_at, id LIMIT 1)
    RETURNING *`)
    .bind(crypto.randomUUID(), now + 600_000, now, now)
    .first<TeardownJob>();
}

export async function finishTeardown(
  db: D1Database,
  job: TeardownJob,
  error?: string,
  now = Date.now(),
  blocked = false,
): Promise<void> {
  const delay = Math.min(3_600_000, 60_000 * 2 ** Math.min(job.attempts - 1, 6));
  await db
    .prepare(`UPDATE teardown_jobs SET status = ?, last_error = ?, next_attempt_at = ?, lease_until = 0,
    completed_at = ?, token = NULL WHERE id = ? AND token = ? AND status = 'running'`)
    .bind(
      blocked ? "blocked" : error ? "pending" : "complete",
      error ?? null,
      error ? now + delay : 0,
      error ? null : now,
      job.id,
      job.token,
    )
    .run();
}

export async function retryTeardown(db: D1Database | undefined, id: string): Promise<void> {
  // An operator cannot steal a running lease; the cron recovers an expired one automatically.
  await teardownDb(db)
    .prepare(
      `UPDATE teardown_jobs SET status = 'pending', next_attempt_at = 0 WHERE id = ? AND status IN ('pending', 'blocked')`,
    )
    .bind(id)
    .run();
}

export async function listTeardowns(db: D1Database | undefined): Promise<TeardownJob[]> {
  const result = await teardownDb(db)
    .prepare(
      `SELECT * FROM teardown_jobs WHERE status IN ('pending', 'running', 'blocked') ORDER BY created_at LIMIT 100`,
    )
    .all<TeardownJob>();
  return result.results;
}

// Manual resolution is distinct from verified automatic cleanup and retains its error history.
export async function resolveTeardown(
  db: D1Database | undefined,
  id: string,
  note: string,
): Promise<void> {
  if (!note.trim()) throw new Error("A manual resolution note is required");
  await teardownDb(db)
    .prepare(`UPDATE teardown_jobs SET status = 'resolved', resolution_note = ?, completed_at = ?
      WHERE id = ? AND status = 'blocked'`)
    .bind(note.trim(), Date.now(), id)
    .run();
}
