export interface ActivationLockEnv {
  OUTREACH_DB?: D1Database;
}

export async function acquireActivationLock(
  db: D1Database | undefined,
  leadId: string,
  token: string,
  acquiredAt = new Date().toISOString(),
): Promise<boolean> {
  if (!db) throw new Error("OUTREACH_DB is not configured");
  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO activation_locks (lead_id, token, acquired_at)
       VALUES (?, ?, ?)
       RETURNING lead_id`,
    )
    .bind(leadId, token, acquiredAt)
    .first<{ lead_id: string }>();
  return inserted?.lead_id === leadId;
}

export async function releaseActivationLock(
  db: D1Database | undefined,
  leadId: string,
  token: string,
): Promise<void> {
  if (!db) throw new Error("OUTREACH_DB is not configured");
  await db
    .prepare("DELETE FROM activation_locks WHERE lead_id = ? AND token = ?")
    .bind(leadId, token)
    .run();
}
