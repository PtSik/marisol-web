import { type NotifyEnv, notifyTeam } from "@/lib/notify";
import { patchShop } from "@/lib/provisioning";
import { type EnrichmentRow, NEUTRAL_DEMO_PATCH, demoShopPatch } from "@/lib/sales/demoKnowledge";
import { type TwilioEnv, listInboundCalls } from "@/lib/twilio";
import type { VoiceAgentEnv } from "@/lib/voiceAgent";

export interface DemoPoolEnv extends VoiceAgentEnv, TwilioEnv, NotifyEnv {
  OUTREACH_DB?: D1Database;
  DEMO_POOL_AGENT_ID?: string;
  DEMO_POOL_AGENT_ID_ES?: string;
}

// Twelve hours, not twenty-four: staggered daily expiries mean day two starts holding day one's
// numbers, and day one is exactly when the pool is tightest. At twelve, every morning opens full.
const TTL_HOURS = 12;
// Owners often call a second time to show someone, so the number stays theirs for an hour after
// the call ends rather than being recycled the moment they hang up.
const GRACE_HOURS = 1;

export interface DemoNumber {
  phone_e164: string;
  twilio_sid: string;
  shop_id: string;
  state: "idle" | "assigned" | "grace";
  lead_id: string | null;
  lead_lang: string | null;
  assigned_at: string | null;
  expires_at: string | null;
  grace_until: string | null;
  called_at: string | null;
}

export type AssignResult =
  | { ok: true; number: DemoNumber }
  | { ok: false; reason: "pool_full" | "failed"; freeAt?: string };

const hoursFrom = (iso: string, hours: number): string =>
  new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();

function agentFor(env: DemoPoolEnv, lang: string): string | undefined {
  // The opening line no longer depends on this: assignNumber sets the shop's primary_language,
  // which the personalization webhook turns into a language override. A dedicated ES clone is
  // now only worth setting if it needs a genuinely different prompt, not just a Spanish greeting.
  const es = env.DEMO_POOL_AGENT_ID_ES?.trim();
  if (lang === "es" && es) return es;
  return env.DEMO_POOL_AGENT_ID?.trim() || undefined;
}

export async function activeNumberFor(db: D1Database, leadId: string): Promise<DemoNumber | null> {
  return await db
    .prepare("SELECT * FROM demo_numbers WHERE lead_id = ? AND state IN ('assigned', 'grace')")
    .bind(leadId)
    .first<DemoNumber>();
}

export interface PoolStatus {
  free: number;
  busy: number;
  nextFreeAt: string | null;
}

export async function poolStatus(db: D1Database): Promise<PoolStatus> {
  const row = await db
    .prepare(
      `SELECT SUM(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) AS free,
              SUM(CASE WHEN state <> 'idle' THEN 1 ELSE 0 END) AS busy,
              MIN(CASE WHEN state <> 'idle' THEN COALESCE(grace_until, expires_at) END) AS nextFreeAt
         FROM demo_numbers`,
    )
    .first<{ free: number | null; busy: number | null; nextFreeAt: string | null }>();
  return { free: row?.free ?? 0, busy: row?.busy ?? 0, nextFreeAt: row?.nextFreeAt ?? null };
}

// Claims the least recently used idle number and rewrites its shop to answer as the prospect's
// salon. The claim is a single conditional UPDATE, so two reps clicking at once cannot take the
// same row; if rewriting the shop then fails, the claim is rolled back and no number is burnt.
export async function assignNumber(
  env: DemoPoolEnv,
  lead: { id: string; shop_name: string; hours?: string | null; address?: string | null },
  lang: "en" | "es",
  now = new Date(),
): Promise<AssignResult> {
  const db = env.OUTREACH_DB;
  if (!db) return { ok: false, reason: "failed" };

  const existing = await activeNumberFor(db, lead.id);
  if (existing) return { ok: true, number: existing };

  const iso = now.toISOString();
  const claimed = await db
    .prepare(
      `UPDATE demo_numbers
          SET state = 'assigned', lead_id = ?, lead_lang = ?, assigned_at = ?, expires_at = ?,
              grace_until = NULL, called_at = NULL, updated_at = ?
        WHERE phone_e164 = (
                SELECT phone_e164 FROM demo_numbers WHERE state = 'idle'
                 ORDER BY updated_at LIMIT 1)
        RETURNING *`,
    )
    .bind(lead.id, lang, iso, hoursFrom(iso, TTL_HOURS), iso)
    .first<DemoNumber>()
    .catch(() => null);

  if (!claimed) {
    const { nextFreeAt } = await poolStatus(db);
    return { ok: false, reason: "pool_full", freeAt: nextFreeAt ?? undefined };
  }

  // Best-effort: a lead we never enriched still gets a demo, just on the reviewed menu.
  const enrichment = await db
    .prepare("SELECT services, service_confidence, note FROM lead_enrichment WHERE lead_id = ?")
    .bind(lead.id)
    .first<EnrichmentRow>()
    .catch(() => null);

  // Name, language, address, hours and menu in one PATCH. The opening language rides on the shop,
  // so a Spanish lead gets a Spanish-opening demo off the one English clone.
  const patched = await patchShop(
    env,
    claimed.shop_id,
    demoShopPatch({ lead, enrichment, lang, agentId: agentFor(env, lang) }),
  );
  if (!patched) {
    await releaseNumber(env, claimed.phone_e164, now).catch(() => {});
    return { ok: false, reason: "failed" };
  }
  return { ok: true, number: claimed };
}

// Rewrites the shop back to the neutral demo before freeing the row: a number that still answers
// as someone else's salon is worse than a number that never rang.
export async function releaseNumber(
  env: DemoPoolEnv,
  phone: string,
  now = new Date(),
): Promise<void> {
  const db = env.OUTREACH_DB;
  if (!db) return;
  const row = await db
    .prepare("SELECT * FROM demo_numbers WHERE phone_e164 = ?")
    .bind(phone)
    .first<DemoNumber>();
  if (!row) return;

  // Reset with the name: a recycled number still holding the last prospect's language, hours,
  // street address or price list is the same leak as one still answering as their salon.
  await patchShop(env, row.shop_id, {
    ...NEUTRAL_DEMO_PATCH,
    ...(env.DEMO_POOL_AGENT_ID ? { elevenlabs_agent_id: env.DEMO_POOL_AGENT_ID } : {}),
  });
  await db
    .prepare(
      `UPDATE demo_numbers
          SET state = 'idle', lead_id = NULL, lead_lang = NULL, assigned_at = NULL,
              expires_at = NULL, grace_until = NULL, called_at = NULL, updated_at = ?
        WHERE phone_e164 = ?`,
    )
    .bind(now.toISOString(), phone)
    .run();
}

export async function releaseForLead(env: DemoPoolEnv, leadId: string, now = new Date()) {
  const db = env.OUTREACH_DB;
  if (!db) return;
  const row = await activeNumberFor(db, leadId);
  if (row) await releaseNumber(env, row.phone_e164, now);
}

async function noteCall(
  env: DemoPoolEnv,
  row: DemoNumber,
  call: { startedAt: string; endedAt: string | null },
  now: Date,
): Promise<void> {
  const db = env.OUTREACH_DB;
  if (!db || !row.lead_id) return;
  const graceUntil = hoursFrom(call.endedAt ?? now.toISOString(), GRACE_HOURS);
  const iso = now.toISOString();

  await db.batch([
    db
      .prepare(
        `UPDATE demo_numbers SET state = 'grace', called_at = ?, grace_until = ?, updated_at = ?
          WHERE phone_e164 = ?`,
      )
      .bind(call.startedAt, graceUntil, iso, row.phone_e164),
    db
      .prepare(
        "UPDATE lead_state SET demo_called_at = COALESCE(demo_called_at, ?), updated_at = ? WHERE lead_id = ?",
      )
      .bind(call.startedAt, iso, row.lead_id),
    db
      .prepare(
        `INSERT INTO lead_events (lead_id, actor, outcome, note, created_at)
         VALUES (?, 'system', NULL, 'demo called', ?)`,
      )
      .bind(row.lead_id, call.startedAt),
  ]);

  const lead = await db
    .prepare("SELECT shop_name, phone_e164 FROM leads WHERE id = ?")
    .bind(row.lead_id)
    .first<{ shop_name: string; phone_e164: string }>();

  await notifyTeam(env, `📞 Demo called — ${lead?.shop_name ?? row.lead_id}`, {
    shop: lead?.shop_name,
    theirNumber: lead?.phone_e164,
    demoNumber: row.phone_e164,
    calledAt: call.startedAt,
    language: row.lead_lang,
  });
}

// Runs on every /sales render, which is what replaces a cron — this Worker has no triggers and
// its `worker/index.ts` never executes. Never throws: a demo that fails to expire must not take
// down the page the rep is calling from.
export async function sweepDemoPool(env: DemoPoolEnv, now = new Date()): Promise<void> {
  const db = env.OUTREACH_DB;
  if (!db) return;
  try {
    const { results } = await db
      .prepare("SELECT * FROM demo_numbers WHERE state IN ('assigned', 'grace')")
      .all<DemoNumber>();
    const iso = now.toISOString();

    for (const row of results ?? []) {
      await (async () => {
        if (row.state === "grace") {
          if (row.grace_until && row.grace_until <= iso)
            await releaseNumber(env, row.phone_e164, now);
          return;
        }
        const since = row.assigned_at ? new Date(row.assigned_at) : now;
        const [call] = await listInboundCalls(env, row.phone_e164, since);
        if (call) {
          await noteCall(env, row, call, now);
          return;
        }
        if (row.expires_at && row.expires_at <= iso) await releaseNumber(env, row.phone_e164, now);
      })().catch(() => {});
    }
  } catch {
    /* best-effort; the next page view retries */
  }
}
