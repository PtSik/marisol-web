import { type DemoKnowledge, demoKnowledge } from "@/lib/sales/demoKnowledge";
import { type EsStrength, type Tier, hook, openNow } from "@/lib/sales/derive";

export const OUTCOMES = [
  "new",
  "no_answer",
  "callback",
  "gatekeeper",
  "interested",
  "demo_sent",
  "not_interested",
  "wrong_number",
  "dead",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  new: "not called",
  no_answer: "no answer",
  callback: "call back",
  gatekeeper: "gatekeeper",
  interested: "interested",
  demo_sent: "demo sent",
  not_interested: "not interested",
  wrong_number: "wrong number",
  dead: "dead",
};

// Outcomes that mean the rep actually got through to a person — these do not raise the attempt
// counter a second time on an edit, and they take the lead out of the default queue.
export const CONTACTED: ReadonlySet<Outcome> = new Set([
  "gatekeeper",
  "interested",
  "demo_sent",
  "not_interested",
  "wrong_number",
  "dead",
]);

export function isOutcome(value: unknown): value is Outcome {
  return typeof value === "string" && (OUTCOMES as readonly string[]).includes(value);
}

export interface LeadRow {
  id: string;
  shop_name: string;
  phone_e164: string;
  slug: string;
  neighborhood: string;
  address: string | null;
  hours: string | null;
  rating: number | null;
  review_count: number;
  is_mobile: number;
  is_chain: number;
  booking_app: string;
  es_strength: EsStrength;
  prices: string | null;
  price_confidence: string;
  website: string | null;
  instagram: string | null;
  score: number;
  tier: Tier;
  outcome: Outcome;
  attempts: number;
  owner: string | null;
  last_contact_at: string | null;
  next_followup: string | null;
  note: string | null;
  demo_lang: string | null;
  demo_requested_at: string | null;
  demo_called_at: string | null;
  demo_number: string | null;
  demo_expires_at: string | null;
}

export interface SalesLead extends LeadRow {
  openState: ReturnType<typeof openNow>;
  hookLine: string;
  // What the demo will and will not be able to answer for this lead. Computed here rather than in
  // the card so the rep sees the same verdict `assignNumber` will act on.
  demoKnows: DemoKnowledge;
}

// The enrichment columns ride along on the query but are not part of a lead. `decorate` folds them
// into `demoKnows` and drops them, so nothing downstream has to know the table exists.
interface LeadQueryRow extends LeadRow {
  services: string | null;
  service_confidence: string | null;
  enrichment_note: string | null;
}

export interface LeadFilters {
  neighborhood?: string;
  tiers?: Tier[];
  outcome?: Outcome | "queue";
  openOnly?: boolean;
  es?: EsStrength;
}

const SELECT = `
  SELECT l.*, s.outcome, s.attempts, s.owner, s.last_contact_at, s.next_followup, s.note,
         s.demo_lang, s.demo_requested_at, s.demo_called_at,
         d.phone_e164 AS demo_number, COALESCE(d.grace_until, d.expires_at) AS demo_expires_at,
         e.services, e.service_confidence, e.note AS enrichment_note
  FROM leads l
  JOIN lead_state s ON s.lead_id = l.id
  LEFT JOIN demo_numbers d ON d.lead_id = l.id AND d.state IN ('assigned', 'grace')
  LEFT JOIN lead_enrichment e ON e.lead_id = l.id
`;

function decorate(row: LeadQueryRow, now: Date): SalesLead {
  const { services, service_confidence, enrichment_note, ...lead } = row;
  return {
    ...lead,
    openState: openNow(lead.hours, now),
    hookLine: hook({
      booking_app: lead.booking_app,
      is_mobile: lead.is_mobile === 1,
      review_count: lead.review_count,
      es_strength: lead.es_strength,
      hours: lead.hours,
      website: lead.website,
    }),
    demoKnows: demoKnowledge(lead, {
      services,
      // A lead with no enrichment row at all reads the same as one we tried and could not use.
      service_confidence: service_confidence ?? "none",
      note: enrichment_note,
    }),
  };
}

export async function listLeads(
  db: D1Database,
  filters: LeadFilters,
  now = new Date(),
): Promise<SalesLead[]> {
  const where: string[] = [];
  const binds: unknown[] = [];

  if (filters.neighborhood) {
    where.push("l.neighborhood = ?");
    binds.push(filters.neighborhood);
  }
  if (filters.tiers && filters.tiers.length > 0) {
    where.push(`l.tier IN (${filters.tiers.map(() => "?").join(", ")})`);
    binds.push(...filters.tiers);
  }
  if (filters.es) {
    where.push("l.es_strength = ?");
    binds.push(filters.es);
  }
  if (filters.outcome === "queue") {
    // The default queue: never called, or a callback that is due today or overdue.
    where.push("(s.outcome = 'new' OR (s.outcome = 'callback' AND s.next_followup <= ?))");
    binds.push(today(now));
  } else if (filters.outcome) {
    where.push("s.outcome = ?");
    binds.push(filters.outcome);
  }

  const sql = `${SELECT}${where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""}
    ORDER BY CASE l.tier WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 ELSE 3 END,
             l.score DESC, l.review_count DESC`;

  const { results } = await db
    .prepare(sql)
    .bind(...binds)
    .all<LeadQueryRow>();
  const leads = (results ?? []).map((row) => decorate(row, now));
  return filters.openOnly ? leads.filter((l) => l.openState === "open") : leads;
}

export async function getLead(db: D1Database, id: string, now = new Date()) {
  const row = await db.prepare(`${SELECT} WHERE l.id = ?`).bind(id).first<LeadQueryRow>();
  return row ? decorate(row, now) : null;
}

export interface Counters {
  queue: number;
  calledToday: number;
  demoRequested: number;
  demosHeard: number;
}

// Counted over the same area and tiers the rep is looking at — a header saying 119 above a list of
// 20 reads as a bug, not as extra information. The outcome filter deliberately does not narrow it:
// "left to call" has to stay meaningful while browsing, say, the interested leads.
export async function counters(
  db: D1Database,
  now = new Date(),
  scope: { neighborhood?: string; tiers?: Tier[] } = {},
): Promise<Counters> {
  const day = today(now);
  const tiers = scope.tiers ?? [];
  const tierClause = tiers.length > 0 ? ` AND l.tier IN (${tiers.map(() => "?").join(", ")})` : "";

  const row = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN s.outcome = 'new'
                   OR (s.outcome = 'callback' AND s.next_followup <= ?1) THEN 1 ELSE 0 END) AS queue,
         SUM(CASE WHEN substr(s.last_contact_at, 1, 10) = ?1 THEN 1 ELSE 0 END) AS calledToday,
         SUM(CASE WHEN s.demo_requested_at IS NOT NULL THEN 1 ELSE 0 END) AS demoRequested,
         SUM(CASE WHEN s.demo_called_at IS NOT NULL THEN 1 ELSE 0 END) AS demosHeard
       FROM lead_state s
       JOIN leads l ON l.id = s.lead_id
       WHERE (?2 IS NULL OR l.neighborhood = ?2)${tierClause}`,
    )
    .bind(day, scope.neighborhood ?? null, ...tiers)
    .first<{
      queue: number | null;
      calledToday: number | null;
      demoRequested: number | null;
      demosHeard: number | null;
    }>();

  return {
    queue: row?.queue ?? 0,
    calledToday: row?.calledToday ?? 0,
    demoRequested: row?.demoRequested ?? 0,
    demosHeard: row?.demosHeard ?? 0,
  };
}

export async function neighborhoods(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT DISTINCT neighborhood FROM leads ORDER BY neighborhood")
    .all<{ neighborhood: string }>();
  return (results ?? []).map((r) => r.neighborhood).filter(Boolean);
}

export interface StateUpdate {
  outcome: Outcome;
  actor: string;
  note?: string;
  nextFollowup?: string;
}

export async function recordOutcome(
  db: D1Database,
  leadId: string,
  update: StateUpdate,
  now = new Date(),
): Promise<void> {
  const iso = now.toISOString();
  // Only a real dial attempt raises the counter — re-filing a lead as `new` or setting a callback
  // date after the fact must not inflate it.
  const isAttempt = update.outcome !== "new";

  await db.batch([
    db
      .prepare(
        `UPDATE lead_state
            SET outcome = ?, attempts = attempts + ?, owner = ?, note = ?,
                next_followup = ?, last_contact_at = ?, updated_at = ?
          WHERE lead_id = ?`,
      )
      .bind(
        update.outcome,
        isAttempt ? 1 : 0,
        update.actor,
        update.note ?? null,
        update.nextFollowup ?? null,
        isAttempt ? iso : null,
        iso,
        leadId,
      ),
    db
      .prepare(
        `INSERT INTO lead_events (lead_id, actor, outcome, note, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(leadId, update.actor, update.outcome, update.note ?? null, iso),
  ]);
}

// Records the rep's intent; leasing the number itself lives in `demoPool.assignNumber`, so a full
// pool still leaves a trace of who asked for what.
export async function requestDemo(
  db: D1Database,
  leadId: string,
  lang: "en" | "es",
  actor: string,
  now = new Date(),
): Promise<void> {
  const iso = now.toISOString();
  await db.batch([
    db
      .prepare(
        "UPDATE lead_state SET demo_lang = ?, demo_requested_at = ?, updated_at = ? WHERE lead_id = ?",
      )
      .bind(lang, iso, iso, leadId),
    db
      .prepare(
        `INSERT INTO lead_events (lead_id, actor, outcome, note, created_at)
         VALUES (?, ?, NULL, ?, ?)`,
      )
      .bind(leadId, actor, `demo requested (${lang})`, iso),
  ]);
}

// "This one's dead" from the rep frees a number faster than any timer, so the cancel button is
// worth more throughput than tuning the TTL.
export async function cancelDemo(
  db: D1Database,
  leadId: string,
  actor: string,
  now = new Date(),
): Promise<void> {
  const iso = now.toISOString();
  await db.batch([
    db
      .prepare(
        "UPDATE lead_state SET demo_lang = NULL, demo_requested_at = NULL, updated_at = ? WHERE lead_id = ?",
      )
      .bind(iso, leadId),
    db
      .prepare(
        `INSERT INTO lead_events (lead_id, actor, outcome, note, created_at)
         VALUES (?, ?, NULL, 'demo cancelled', ?)`,
      )
      .bind(leadId, actor, iso),
  ]);
}

export interface LeadEvent {
  actor: string;
  outcome: string | null;
  note: string | null;
  created_at: string;
}

export async function leadHistory(db: D1Database, leadId: string): Promise<LeadEvent[]> {
  const { results } = await db
    .prepare(
      "SELECT actor, outcome, note, created_at FROM lead_events WHERE lead_id = ? ORDER BY created_at DESC LIMIT 20",
    )
    .bind(leadId)
    .all<LeadEvent>();
  return results ?? [];
}

export function today(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
