import { type DemoKnowledge, demoKnowledge } from "@/lib/sales/demoKnowledge";
import {
  type EsStrength,
  type OpenState,
  SHOP_TIMEZONE,
  type ShopClock,
  type Tier,
  hook,
  openAt,
  parseWeekHours,
  shopClock,
} from "@/lib/sales/derive";
import { type Channel, OTHER_AREA } from "@/lib/sales/leadFilters";

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

// The same nine outcomes said the way a doorstep visit ends, so a market worked on foot and one
// worked by phone stay one funnel — same enum, same history, same counters.
const WALK_LABELS: Partial<Record<Outcome, string>> = {
  new: "not visited",
  no_answer: "owner out",
  callback: "come back",
  gatekeeper: "staff only",
  demo_sent: "demo shown",
  wrong_number: "not there anymore",
};

export const outcomeLabel = (outcome: Outcome, channel: Channel = "call"): string =>
  (channel === "walk" ? WALK_LABELS[outcome] : undefined) ?? OUTCOME_LABELS[outcome];

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
  zip: number | null;
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
  openState: OpenState;
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
  channel?: Channel;
  /** One block of the route. Only ever set in walk mode, where it is the unit a rep works. */
  zip?: number;
  /** Inverts the route's exclusion: the vans the rep passes but cannot walk into. */
  mobile?: boolean;
}

export const LEADS_PAGE_SIZE = 25;

export interface LeadPage {
  leads: SalesLead[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

const FROM = "FROM leads l JOIN lead_state s ON s.lead_id = l.id";

const BY_TIER = "CASE l.tier WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 ELSE 3 END";

// `l.id` breaks ties the other terms leave open. Without it SQLite is free to order two
// equal-scoring leads differently between the count, the page and the id pass, which silently
// duplicates one lead across two pages and drops another.
//
// On foot the ZIP outranks the score: the shop on the next block costs a minute whatever its tier,
// and the best lead in the metro costs a drive. Score still decides the order inside a ZIP.
const orderBy = (channel: Channel = "call"): string =>
  channel === "walk"
    ? `l.zip IS NULL, l.zip ASC, ${BY_TIER}, l.score DESC, l.id ASC`
    : `${BY_TIER}, l.score DESC, l.review_count DESC, l.id ASC`;

function decorate(row: LeadQueryRow, clock: ShopClock): SalesLead {
  const { services, service_confidence, enrichment_note, ...lead } = row;
  const week = parseWeekHours(lead.hours);
  return {
    ...lead,
    openState: openAt(week, clock),
    hookLine: hook({
      booking_app: lead.booking_app,
      is_mobile: lead.is_mobile === 1,
      review_count: lead.review_count,
      es_strength: lead.es_strength,
      hours: week,
      website: lead.website,
    }),
    demoKnows: demoKnowledge(
      lead,
      {
        services,
        // A lead with no enrichment row at all reads the same as one we tried and could not use.
        service_confidence: service_confidence ?? "none",
        note: enrichment_note,
      },
      week,
    ),
  };
}

function buildWhere(filters: LeadFilters, now: Date): { clause: string; binds: unknown[] } {
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
  // A van has no door and an address-less lead has nothing to navigate to, so neither belongs on a
  // route — and `is_mobile` is worth +4, which parks exactly those leads at the top of the queue.
  // Both stay reachable on the phone, which is the only way they were ever workable.
  if (filters.mobile) {
    where.push("l.is_mobile = 1");
  } else if (filters.channel === "walk") {
    where.push("l.is_mobile = 0", "l.address IS NOT NULL", "trim(l.address) <> ''");
  }
  if (filters.zip !== undefined) {
    where.push("l.zip = ?");
    binds.push(filters.zip);
  }
  if (filters.outcome === "queue") {
    // The default queue: never called, or a callback that is due today or overdue.
    where.push("(s.outcome = 'new' OR (s.outcome = 'callback' AND s.next_followup <= ?))");
    binds.push(today(now));
  } else if (filters.outcome) {
    where.push("s.outcome = ?");
    binds.push(filters.outcome);
  }

  return { clause: where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "", binds };
}

export function parsePageParam(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const n = Number.parseInt(raw, 10);
  return n >= 1 ? n : 1;
}

function pageBounds(total: number, page: number) {
  const totalPages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const clamped = Math.min(Math.max(Math.trunc(page) || 1, 1), totalPages);
  return { totalPages, page: clamped, offset: (clamped - 1) * LEADS_PAGE_SIZE };
}

async function countWhere(db: D1Database, clause: string, binds: unknown[]): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n ${FROM}${clause}`)
    .bind(...binds)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// Every filter but `openOnly` is a WHERE clause, so the count and the page are two views of one SQL
// predicate and cannot disagree. `decorate` — the expensive part of a render — only ever sees the
// page.
async function listSqlPagedLeads(
  db: D1Database,
  filters: LeadFilters,
  now: Date,
  page: number,
): Promise<LeadPage> {
  const { clause, binds } = buildWhere(filters, now);
  const total = await countWhere(db, clause, binds);
  const bounds = pageBounds(total, page);

  const { results } = await db
    .prepare(`${SELECT}${clause} ORDER BY ${orderBy(filters.channel)} LIMIT ? OFFSET ?`)
    .bind(...binds, LEADS_PAGE_SIZE, bounds.offset)
    .all<LeadQueryRow>();

  const clock = shopClock(now);
  return {
    leads: (results ?? []).map((row) => decorate(row, clock)),
    page: bounds.page,
    pageSize: LEADS_PAGE_SIZE,
    total,
    totalPages: bounds.totalPages,
  };
}

// `openNow` cannot become a WHERE clause — `hours` is free text and D1 has no user functions — so
// the total and the page order have to come out of one JS pass over every SQL-matching row. Two
// columns and no `decorate` keep that pass cheap enough to run on each load.
async function fetchOpenOrderedIds(
  db: D1Database,
  filters: LeadFilters,
  now: Date,
): Promise<string[]> {
  const { clause, binds } = buildWhere(filters, now);
  const { results } = await db
    .prepare(`SELECT l.id, l.hours ${FROM}${clause} ORDER BY ${orderBy(filters.channel)}`)
    .bind(...binds)
    .all<{ id: string; hours: string | null }>();

  const clock = shopClock(now);
  return (results ?? [])
    .filter((row) => openAt(parseWeekHours(row.hours), clock) === "open")
    .map((row) => row.id);
}

async function listOpenOnlyPagedLeads(
  db: D1Database,
  filters: LeadFilters,
  now: Date,
  page: number,
): Promise<LeadPage> {
  const orderedIds = await fetchOpenOrderedIds(db, filters, now);
  const total = orderedIds.length;
  const bounds = pageBounds(total, page);
  const pageIds = orderedIds.slice(bounds.offset, bounds.offset + LEADS_PAGE_SIZE);

  const meta = {
    page: bounds.page,
    pageSize: LEADS_PAGE_SIZE,
    total,
    totalPages: bounds.totalPages,
  };
  if (pageIds.length === 0) return { leads: [], ...meta };

  const { results } = await db
    .prepare(`${SELECT} WHERE l.id IN (${pageIds.map(() => "?").join(", ")})`)
    .bind(...pageIds)
    .all<LeadQueryRow>();
  const byId = new Map((results ?? []).map((row) => [row.id, row]));

  // `IN` does not promise to return rows in the order of the list, so the page is rebuilt from the
  // id order the pass above already decided.
  const clock = shopClock(now);
  return {
    leads: pageIds
      .map((id) => byId.get(id))
      .filter((row): row is LeadQueryRow => row !== undefined)
      .map((row) => decorate(row, clock)),
    ...meta,
  };
}

export async function listLeads(
  db: D1Database,
  filters: LeadFilters,
  now = new Date(),
  page = 1,
): Promise<LeadPage> {
  return filters.openOnly
    ? listOpenOnlyPagedLeads(db, filters, now, page)
    : listSqlPagedLeads(db, filters, now, page);
}

export async function countLeads(
  db: D1Database,
  filters: LeadFilters,
  now = new Date(),
): Promise<number> {
  // Shares `listLeads`' filtering rather than counting rows the JS-side `openOnly` filter would
  // later drop — the two used to disagree whenever that filter was on.
  if (filters.openOnly) return (await fetchOpenOrderedIds(db, filters, now)).length;
  const { clause, binds } = buildWhere(filters, now);
  return countWhere(db, clause, binds);
}

export async function getLead(db: D1Database, id: string, now = new Date()) {
  const row = await db.prepare(`${SELECT} WHERE l.id = ?`).bind(id).first<LeadQueryRow>();
  return row ? decorate(row, shopClock(now)) : null;
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
  scope: { neighborhood?: string; tiers?: Tier[]; channel?: Channel } = {},
): Promise<Counters> {
  const day = today(now);
  const tiers = scope.tiers ?? [];
  const tierClause = tiers.length > 0 ? ` AND l.tier IN (${tiers.map(() => "?").join(", ")})` : "";
  // Same exclusions as the route itself, or "left to visit" counts doors that are not there.
  const walkClause =
    scope.channel === "walk" ? " AND l.is_mobile = 0 AND trim(COALESCE(l.address, '')) <> ''" : "";

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
       WHERE (?2 IS NULL OR l.neighborhood = ?2)${tierClause}${walkClause}`,
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
    .prepare(
      // `Other` is the catch-all, so it belongs after the real areas rather than alphabetically
      // between North Miami and St. Augustine.
      `SELECT DISTINCT neighborhood FROM leads
        ORDER BY neighborhood = ?, neighborhood`,
    )
    .bind(OTHER_AREA)
    .all<{ neighborhood: string }>();
  return (results ?? []).map((r) => r.neighborhood).filter(Boolean);
}

/**
 * The blocks a route covers, in walking order. Scoped to one area — a bare ZIP list is unusable.
 *
 * Excludes the same leads the route itself does, or a block whose only lead is a van offers the rep
 * a walk with nothing to walk into: 06461 in Stratford is exactly that today.
 */
export async function zipsIn(db: D1Database, neighborhood: string): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT zip FROM leads
        WHERE neighborhood = ? AND zip IS NOT NULL
          AND is_mobile = 0 AND trim(COALESCE(address, '')) <> ''
        ORDER BY zip`,
    )
    .bind(neighborhood)
    .all<{ zip: number }>();
  return (results ?? []).map((r) => r.zip);
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

// Hoisted for the same reason as `openNow`'s clock: `toLocaleDateString` builds a formatter on every
// call, and a /sales render makes this call up to five times.
const SHOP_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIMEZONE });

export function today(now = new Date()): string {
  return SHOP_DAY.format(now);
}
