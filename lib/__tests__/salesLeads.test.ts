import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import {
  cancelDemo,
  counters,
  getLead,
  leadHistory,
  listLeads,
  recordOutcome,
  requestDemo,
} from "@/lib/sales/leads";

// The queries run against a real SQLite file rather than a stub, so schema drift and SQL mistakes
// surface here instead of in production. `bun:sqlite` speaks the same dialect D1 does.
type Row = Record<string, unknown>;

function d1(db: Database): D1Database {
  const prepare = (sql: string, binds: unknown[] = []) => ({
    bind: (...next: unknown[]) => prepare(sql, next),
    all: async () => ({ results: db.query(sql).all(...(binds as never[])) as Row[] }),
    first: async () => (db.query(sql).get(...(binds as never[])) as Row | null) ?? null,
    run: async () => {
      db.query(sql).run(...(binds as never[]));
      return { success: true };
    },
  });

  return {
    prepare: (sql: string) => prepare(sql),
    batch: async (statements: { run: () => Promise<unknown> }[]) => {
      for (const statement of statements) await statement.run();
      return [];
    },
  } as unknown as D1Database;
}

const SCHEMA = `${await Bun.file("d1/0001_outreach.sql").text()}
${await Bun.file("d1/0002_demo_pool.sql").text()}
${await Bun.file("d1/0003_lead_enrichment.sql").text()}`;

interface SeedOptions {
  id: string;
  name: string;
  tier?: string;
  score?: number;
  neighborhood?: string;
  hours?: string | null;
  address?: string | null;
  reviewCount?: number;
}

let sqlite: Database;
let db: D1Database;

function seed(options: SeedOptions): void {
  sqlite.run(
    `INSERT INTO leads (id, shop_name, phone_e164, slug, neighborhood, hours, address, review_count,
       is_mobile, is_chain, booking_app, es_strength, price_confidence, score, tier, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'none', 'none', 'low', ?, ?, '2026-07-30T00:00:00Z')`,
    [
      options.id,
      options.name,
      `+1305${options.id.slice(-7)}`,
      options.name.toLowerCase().replace(/\W+/g, "-"),
      options.neighborhood ?? "Hialeah",
      options.hours === undefined ? "Monday: 9:00 AM – 5:00 PM" : options.hours,
      options.address ?? null,
      options.reviewCount ?? 100,
      options.score ?? 7,
      options.tier ?? "B",
    ],
  );
  sqlite.run("INSERT INTO lead_state (lead_id, updated_at) VALUES (?, '2026-07-30T00:00:00Z')", [
    options.id,
  ]);
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.run(SCHEMA);
  db = d1(sqlite);
});

describe("demoKnows", () => {
  const FULL_WEEK =
    "Monday: 9:00 AM – 5:00 PM | Tuesday: 9:00 AM – 5:00 PM | Wednesday: 9:00 AM – 5:00 PM | " +
    "Thursday: 9:00 AM – 5:00 PM | Friday: 9:00 AM – 5:00 PM | Saturday: 10:00 AM – 4:00 PM | " +
    "Sunday: Closed";

  function enrich(id: string, confidence: string, services: string | null, note: string | null) {
    sqlite.run(
      `INSERT INTO lead_enrichment (lead_id, services, service_confidence, fetched_at, note)
       VALUES (?, ?, ?, '2026-08-01T00:00:00Z', ?)`,
      [id, services, confidence, note],
    );
  }

  it("reports the demo menu when nothing has been enriched", async () => {
    seed({ id: "3051110001", name: "Bare", hours: FULL_WEEK, address: "1 Main St" });

    const lead = await getLead(db, "3051110001");
    expect(lead?.demoKnows).toMatchObject({ hours: true, address: true, servicesFromSite: false });
    expect(lead?.demoKnows.serviceCount).toBeGreaterThan(0);
  });

  it("reports the site's own menu once the lead is enriched", async () => {
    seed({ id: "3051110001", name: "Enriched", hours: FULL_WEEK, address: "1 Main St" });
    enrich(
      "3051110001",
      "high",
      JSON.stringify([{ name: "Full Groom", price: "70" }, { name: "Nail Trim" }]),
      null,
    );

    const lead = await getLead(db, "3051110001");
    expect(lead?.demoKnows).toMatchObject({ servicesFromSite: true, serviceCount: 2 });
  });

  it("carries the note explaining why a scrape was not good enough", async () => {
    seed({ id: "3051110001", name: "Weak", hours: null, address: null });
    enrich("3051110001", "low", JSON.stringify([{ name: "Full Groom" }]), "no published prices");

    const lead = await getLead(db, "3051110001");
    expect(lead?.demoKnows).toMatchObject({
      hours: false,
      address: false,
      servicesFromSite: false,
      note: "no published prices",
    });
  });

  it("keeps the enrichment columns off the lead itself", async () => {
    // They ride along on the join only so `decorate` can fold them in; leaking them would give
    // callers a second, unformatted source of truth for what the demo knows.
    seed({ id: "3051110001", name: "Clean" });
    enrich("3051110001", "high", JSON.stringify([{ name: "Full Groom" }]), null);

    const lead = (await getLead(db, "3051110001")) as unknown as Row;
    for (const key of ["services", "service_confidence", "enrichment_note"]) {
      expect(key in lead).toBe(false);
    }
  });
});

describe("listLeads", () => {
  it("orders A before B before C, then by score", () => {
    seed({ id: "3051110001", name: "Low", tier: "C", score: 4 });
    seed({ id: "3051110002", name: "Best", tier: "A", score: 12 });
    seed({ id: "3051110003", name: "Good", tier: "B", score: 8 });

    return listLeads(db, {}).then((leads) => {
      expect(leads.map((l) => l.shop_name)).toEqual(["Best", "Good", "Low"]);
    });
  });

  it("restricts to the requested tiers", async () => {
    seed({ id: "3051110001", name: "Chain", tier: "X" });
    seed({ id: "3051110002", name: "Real", tier: "A" });

    const leads = await listLeads(db, { tiers: ["A", "B"] });
    expect(leads.map((l) => l.shop_name)).toEqual(["Real"]);
  });

  it("keeps callbacks due today in the queue and future ones out", async () => {
    seed({ id: "3051110001", name: "Due", tier: "A" });
    seed({ id: "3051110002", name: "Later", tier: "A" });
    const now = new Date("2026-08-03T18:00:00Z");

    await recordOutcome(db, "3051110001", {
      outcome: "callback",
      actor: "Nina",
      nextFollowup: "2026-08-03",
    });
    await recordOutcome(db, "3051110002", {
      outcome: "callback",
      actor: "Nina",
      nextFollowup: "2026-09-01",
    });

    const queue = await listLeads(db, { outcome: "queue" }, now);
    expect(queue.map((l) => l.shop_name)).toEqual(["Due"]);
  });

  it("drops a lead from the queue once it has an outcome", async () => {
    seed({ id: "3051110001", name: "Called", tier: "A" });
    seed({ id: "3051110002", name: "Fresh", tier: "A" });

    await recordOutcome(db, "3051110001", { outcome: "no_answer", actor: "Marco" });

    const queue = await listLeads(db, { outcome: "queue" });
    expect(queue.map((l) => l.shop_name)).toEqual(["Fresh"]);
  });

  it("filters on open-now using the shop timezone", async () => {
    seed({ id: "3051110001", name: "Open", hours: "Monday: 9:00 AM – 5:00 PM" });
    seed({ id: "3051110002", name: "Shut", hours: "Monday: Closed" });
    seed({ id: "3051110003", name: "NoHours", hours: null });

    const open = await listLeads(db, { openOnly: true }, new Date("2026-08-03T18:00:00Z"));
    expect(open.map((l) => l.shop_name)).toEqual(["Open"]);
  });
});

describe("recordOutcome", () => {
  it("counts a real attempt and stamps the contact time", async () => {
    seed({ id: "3051110001", name: "Shop" });
    const now = new Date("2026-08-03T18:00:00Z");

    await recordOutcome(db, "3051110001", { outcome: "interested", actor: "Marco" }, now);

    const lead = await getLead(db, "3051110001");
    expect(lead?.attempts).toBe(1);
    expect(lead?.owner).toBe("Marco");
    expect(lead?.last_contact_at).toBe(now.toISOString());
  });

  it("does not inflate the counter when a lead is re-filed as new", async () => {
    seed({ id: "3051110001", name: "Shop" });

    await recordOutcome(db, "3051110001", { outcome: "no_answer", actor: "Marco" });
    await recordOutcome(db, "3051110001", { outcome: "new", actor: "Marco" });

    const lead = await getLead(db, "3051110001");
    expect(lead?.attempts).toBe(1);
  });

  it("writes an audit trail entry per attempt", async () => {
    seed({ id: "3051110001", name: "Shop" });

    await recordOutcome(db, "3051110001", { outcome: "no_answer", actor: "Marco" });
    await recordOutcome(db, "3051110001", {
      outcome: "interested",
      actor: "Nina",
      note: "asked for pricing",
    });

    const history = await leadHistory(db, "3051110001");
    expect(history).toHaveLength(2);
    expect(history.map((e) => e.actor)).toContain("Nina");
    expect(history.some((e) => e.note === "asked for pricing")).toBe(true);
  });
});

describe("requestDemo", () => {
  it("stores the language the rep picked without touching the call outcome", async () => {
    seed({ id: "3051110001", name: "Shop" });

    await recordOutcome(db, "3051110001", { outcome: "interested", actor: "Marco" });
    await requestDemo(db, "3051110001", "es", "Marco");

    const lead = await getLead(db, "3051110001");
    expect(lead?.demo_lang).toBe("es");
    expect(lead?.demo_requested_at).not.toBeNull();
    expect(lead?.outcome).toBe("interested");
    expect(lead?.attempts).toBe(1);
  });
});

describe("counters", () => {
  it("counts the queue, today's calls and queued demos", async () => {
    seed({ id: "3051110001", name: "One" });
    seed({ id: "3051110002", name: "Two" });
    seed({ id: "3051110003", name: "Three" });
    const now = new Date("2026-08-03T18:00:00Z");

    await recordOutcome(db, "3051110001", { outcome: "interested", actor: "Marco" }, now);
    await requestDemo(db, "3051110001", "en", "Marco", now);

    const stats = await counters(db, now);
    expect(stats.queue).toBe(2);
    expect(stats.calledToday).toBe(1);
    expect(stats.demoRequested).toBe(1);
  });

  it("counts only the area and tiers the rep is looking at", async () => {
    seed({ id: "3051110001", name: "Local", neighborhood: "Hialeah" });
    seed({ id: "3051110002", name: "Elsewhere", neighborhood: "Doral" });
    seed({ id: "3051110003", name: "AlsoElsewhere", neighborhood: "Doral" });
    seed({ id: "3051110004", name: "LocalChain", neighborhood: "Hialeah", tier: "X" });

    // Area alone still counts the chain sitting in the low-priority group.
    expect((await counters(db, new Date(), { neighborhood: "Hialeah" })).queue).toBe(2);
    expect(
      (await counters(db, new Date(), { neighborhood: "Hialeah", tiers: ["A", "B"] })).queue,
    ).toBe(1);
    expect((await counters(db, new Date())).queue).toBe(4);
  });
});

describe("cancelDemo", () => {
  it("clears the request and leaves the call outcome alone", async () => {
    seed({ id: "3051110001", name: "Shop" });

    await recordOutcome(db, "3051110001", { outcome: "interested", actor: "Marco" });
    await requestDemo(db, "3051110001", "en", "Marco");
    await cancelDemo(db, "3051110001", "Marco");

    const lead = await getLead(db, "3051110001");
    expect(lead?.demo_lang).toBeNull();
    expect(lead?.demo_requested_at).toBeNull();
    expect(lead?.outcome).toBe("interested");

    const history = await leadHistory(db, "3051110001");
    expect(history.some((e) => e.note === "demo cancelled")).toBe(true);
  });
});
