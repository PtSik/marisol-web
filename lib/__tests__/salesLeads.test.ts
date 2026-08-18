import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import type { Tier } from "@/lib/sales/derive";
import {
  LEADS_PAGE_SIZE,
  type LeadFilters,
  cancelDemo,
  countLeads,
  counters,
  getLead,
  getLeadBySlug,
  leadHistory,
  listLeads,
  neighbours,
  parsePageParam,
  recordOutcome,
  requestDemo,
  saveResearch,
  zipsIn,
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
${await Bun.file("d1/0003_lead_enrichment.sql").text()}
${await Bun.file("d1/0004_walk_route.sql").text()}
${await Bun.file("d1/0005_lead_research.sql").text()}`;

interface SeedOptions {
  id: string;
  name: string;
  tier?: string;
  score?: number;
  neighborhood?: string;
  hours?: string | null;
  address?: string | null;
  zip?: number | null;
  isMobile?: boolean;
  reviewCount?: number;
  esStrength?: string;
  outcome?: string;
  nextFollowup?: string | null;
}

let sqlite: Database;
let db: D1Database;

function seed(options: SeedOptions): void {
  sqlite.run(
    `INSERT INTO leads (id, shop_name, phone_e164, slug, neighborhood, hours, address, zip,
       review_count, is_mobile, is_chain, booking_app, es_strength, price_confidence, score, tier,
       imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'none', ?, 'low', ?, ?, '2026-07-30T00:00:00Z')`,
    [
      options.id,
      options.name,
      `+1305${options.id.slice(-7)}`,
      options.name.toLowerCase().replace(/\W+/g, "-"),
      options.neighborhood ?? "Hialeah",
      options.hours === undefined ? "Monday: 9:00 AM – 5:00 PM" : options.hours,
      options.address ?? null,
      options.zip ?? null,
      options.reviewCount ?? 100,
      options.isMobile ? 1 : 0,
      options.esStrength ?? "none",
      options.score ?? 7,
      options.tier ?? "B",
    ],
  );
  sqlite.run(
    "INSERT INTO lead_state (lead_id, outcome, next_followup, updated_at) VALUES (?, ?, ?, '2026-07-30T00:00:00Z')",
    [options.id, options.outcome ?? "new", options.nextFollowup ?? null],
  );
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.run(SCHEMA);
  db = d1(sqlite);
});

describe("listLeads", () => {
  it("orders A before B before C, then by score", () => {
    seed({ id: "3051110001", name: "Low", tier: "C", score: 4 });
    seed({ id: "3051110002", name: "Best", tier: "A", score: 12 });
    seed({ id: "3051110003", name: "Good", tier: "B", score: 8 });

    return listLeads(db, {}).then((page) => {
      expect(page.leads.map((l) => l.shop_name)).toEqual(["Best", "Good", "Low"]);
    });
  });

  it("restricts to the requested tiers", async () => {
    seed({ id: "3051110001", name: "Chain", tier: "X" });
    seed({ id: "3051110002", name: "Real", tier: "A" });

    const { leads } = await listLeads(db, { tiers: ["A", "B"] });
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
    expect(queue.leads.map((l) => l.shop_name)).toEqual(["Due"]);
  });

  it("drops a lead from the queue once it has an outcome", async () => {
    seed({ id: "3051110001", name: "Called", tier: "A" });
    seed({ id: "3051110002", name: "Fresh", tier: "A" });

    await recordOutcome(db, "3051110001", { outcome: "no_answer", actor: "Marco" });

    const queue = await listLeads(db, { outcome: "queue" });
    expect(queue.leads.map((l) => l.shop_name)).toEqual(["Fresh"]);
  });

  it("filters on open-now using the shop timezone", async () => {
    seed({ id: "3051110001", name: "Open", hours: "Monday: 9:00 AM – 5:00 PM" });
    seed({ id: "3051110002", name: "Shut", hours: "Monday: Closed" });
    seed({ id: "3051110003", name: "NoHours", hours: null });

    const open = await listLeads(db, { openOnly: true }, new Date("2026-08-03T18:00:00Z"));
    expect(open.leads.map((l) => l.shop_name)).toEqual(["Open"]);
  });
});

describe("listLeads on a route", () => {
  // A van is worth +4 and lands at the top of the call queue; there is no door to walk into.
  it("drops mobile groomers and leaves them in the call queue", async () => {
    seed({
      id: "3051110001",
      name: "Van",
      tier: "A",
      score: 12,
      address: "1 Main St",
      isMobile: true,
    });
    seed({ id: "3051110002", name: "Shop", tier: "B", score: 8, address: "2 Main St" });

    const route = await listLeads(db, { channel: "walk" });
    expect(route.leads.map((l) => l.shop_name)).toEqual(["Shop"]);

    const calls = await listLeads(db, {});
    expect(calls.leads.map((l) => l.shop_name)).toEqual(["Van", "Shop"]);
  });

  it("drops a lead with no address, and one whose address is blank", async () => {
    seed({ id: "3051110001", name: "Nowhere", tier: "A", score: 12, address: null });
    seed({ id: "3051110002", name: "Blank", tier: "A", score: 11, address: "   " });
    seed({ id: "3051110003", name: "Somewhere", tier: "C", score: 3, address: "3 Main St" });

    const route = await listLeads(db, { channel: "walk" });
    expect(route.leads.map((l) => l.shop_name)).toEqual(["Somewhere"]);
  });

  // The block outranks the score: the shop on this corner costs a minute whatever its tier.
  it("orders by ZIP first and by score only inside a ZIP", async () => {
    seed({
      id: "3051110001",
      name: "Far best",
      tier: "A",
      score: 14,
      address: "1 A St",
      zip: 6615,
    });
    seed({
      id: "3051110002",
      name: "Near weak",
      tier: "C",
      score: 3,
      address: "2 B St",
      zip: 6604,
    });
    seed({
      id: "3051110003",
      name: "Near best",
      tier: "A",
      score: 11,
      address: "3 B St",
      zip: 6604,
    });

    const route = await listLeads(db, { channel: "walk" });
    expect(route.leads.map((l) => l.shop_name)).toEqual(["Near best", "Near weak", "Far best"]);
  });

  it("sorts a lead with no ZIP last rather than first", async () => {
    seed({
      id: "3051110001",
      name: "Unplaced",
      tier: "A",
      score: 14,
      address: "1 A St",
      zip: null,
    });
    seed({ id: "3051110002", name: "Placed", tier: "C", score: 2, address: "2 B St", zip: 6614 });

    const route = await listLeads(db, { channel: "walk" });
    expect(route.leads.map((l) => l.shop_name)).toEqual(["Placed", "Unplaced"]);
  });

  it("narrows to one block, and counts the same set it lists", async () => {
    seed({ id: "3051110001", name: "Here", address: "1 A St", zip: 6614 });
    seed({ id: "3051110002", name: "Also here", address: "2 A St", zip: 6614 });
    seed({ id: "3051110003", name: "Next town", address: "3 B St", zip: 6460 });

    const filters: LeadFilters = { channel: "walk", zip: 6614 };
    const block = await listLeads(db, filters);
    expect(block.leads.map((l) => l.shop_name)).toEqual(["Here", "Also here"]);
    expect(await countLeads(db, filters)).toBe(2);
  });

  it("keeps the count and the page agreeing when open-now runs on top of the route", async () => {
    seed({ id: "3051110001", name: "Open", address: "1 A St", zip: 6614, hours: OPEN_HOURS });
    seed({ id: "3051110002", name: "Shut", address: "2 A St", zip: 6614, hours: CLOSED_HOURS });
    seed({
      id: "3051110003",
      name: "Open van",
      address: "3 A St",
      zip: 6614,
      hours: OPEN_HOURS,
      isMobile: true,
    });

    const filters: LeadFilters = { channel: "walk", openOnly: true };
    const page = await listLeads(db, filters, NOW);
    expect(page.leads.map((l) => l.shop_name)).toEqual(["Open"]);
    expect(page.total).toBe(1);
    expect(await countLeads(db, filters, NOW)).toBe(1);
  });

  // The other half of the route's exclusion: what it drops has to be reachable somewhere, or the
  // highest-scoring leads in the area are simply invisible while a rep is walking it.
  it("lists exactly the vans the route drops", async () => {
    seed({
      id: "3051110001",
      name: "Van",
      tier: "A",
      score: 12,
      address: "1 A St",
      isMobile: true,
    });
    seed({ id: "3051110002", name: "Shop", tier: "B", score: 8, address: "2 A St" });

    const filters: LeadFilters = { mobile: true };
    const vans = await listLeads(db, filters);
    expect(vans.leads.map((l) => l.shop_name)).toEqual(["Van"]);
    expect(await countLeads(db, filters)).toBe(1);
  });

  it("keeps a van with no address, which the route would drop twice over", async () => {
    seed({ id: "3051110001", name: "Van", tier: "A", score: 12, address: null, isMobile: true });

    const vans = await listLeads(db, { mobile: true });
    expect(vans.leads.map((l) => l.shop_name)).toEqual(["Van"]);
  });

  it("offers no block whose only lead cannot be walked into", async () => {
    seed({ id: "3051110001", name: "Van", address: "1 A St", zip: 6461, isMobile: true });
    seed({ id: "3051110002", name: "Nowhere", address: null, zip: 6497 });
    seed({ id: "3051110003", name: "Shop", address: "2 B St", zip: 6614 });

    expect(await zipsIn(db, "Hialeah")).toEqual([6614]);
  });
});

// Monday 18:00 UTC lands in shop-local afternoon, matching the fixture the pre-pagination suite
// already used above.
const NOW = new Date("2026-08-03T18:00:00Z");
const OPEN_HOURS = "Monday: 9:00 AM – 5:00 PM";
const CLOSED_HOURS = "Monday: Closed";

// Distinct from the low ids the pre-pagination tests above use, so a test that seeds dozens of rows
// never collides with a fixture from another `describe` block sharing the same in-memory database.
function idFor(n: number): string {
  return String(4000000000 + n);
}

describe("listLeads pagination", () => {
  it("reaches every lead exactly once when paging the whole unfiltered set (Path A)", async () => {
    const total = 57;
    for (let i = 0; i < total; i++) {
      seed({ id: idFor(i), name: `Shop ${i}`, score: 1000 - i, tier: "B" });
    }

    const first = await listLeads(db, {}, NOW);
    const seen: string[] = [];
    for (let page = 1; page <= first.totalPages; page++) {
      const result = await listLeads(db, {}, NOW, page);
      expect(result.total).toBe(total);
      expect(result.totalPages).toBe(first.totalPages);
      seen.push(...result.leads.map((l) => l.id));
    }

    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
    expect(new Set(seen)).toEqual(new Set(Array.from({ length: total }, (_, i) => idFor(i))));
  });

  it("reaches every open lead exactly once when paging the whole set (Path B)", async () => {
    const total = 40;
    const openIds: string[] = [];
    for (let i = 0; i < total; i++) {
      const isOpen = i % 3 !== 0;
      const id = idFor(i);
      seed({
        id,
        name: `Shop ${i}`,
        score: 1000 - i,
        tier: "B",
        hours: isOpen ? OPEN_HOURS : CLOSED_HOURS,
      });
      if (isOpen) openIds.push(id);
    }
    // Forces the walk across more than one page — the case that broke before this design.
    expect(openIds.length).toBeGreaterThan(LEADS_PAGE_SIZE);

    const first = await listLeads(db, { openOnly: true }, NOW);
    const seen: string[] = [];
    for (let page = 1; page <= first.totalPages; page++) {
      const result = await listLeads(db, { openOnly: true }, NOW, page);
      expect(result.total).toBe(openIds.length);
      expect(result.totalPages).toBe(first.totalPages);
      seen.push(...result.leads.map((l) => l.id));
    }

    expect(seen).toHaveLength(openIds.length);
    expect(new Set(seen)).toEqual(new Set(openIds));
  });

  it("pages correctly when open-now and Spanish signal are combined", async () => {
    const combos = [
      { open: true, es: true },
      { open: true, es: false },
      { open: false, es: true },
      { open: false, es: false },
    ];
    const matchingIds: string[] = [];
    let n = 0;
    for (const combo of combos) {
      for (let k = 0; k < 30; k++, n++) {
        const id = idFor(n);
        seed({
          id,
          name: `Shop ${n}`,
          score: 1000 - n,
          tier: "B",
          hours: combo.open ? OPEN_HOURS : CLOSED_HOURS,
          esStrength: combo.es ? "strong" : "none",
        });
        if (combo.open && combo.es) matchingIds.push(id);
      }
    }
    // 30 rows in the matching quadrant forces more than one page here too.
    expect(matchingIds.length).toBeGreaterThan(LEADS_PAGE_SIZE);

    const filters: LeadFilters = { openOnly: true, es: "strong" };
    const first = await listLeads(db, filters, NOW);
    const seen: string[] = [];
    for (let page = 1; page <= first.totalPages; page++) {
      const result = await listLeads(db, filters, NOW, page);
      expect(result.total).toBe(matchingIds.length);
      seen.push(...result.leads.map((l) => l.id));
    }

    expect(seen).toHaveLength(matchingIds.length);
    expect(new Set(seen)).toEqual(new Set(matchingIds));
  });

  it("Path B's open subset equals Path A's full set filtered by openState in JS", async () => {
    const total = 50;
    for (let i = 0; i < total; i++) {
      seed({
        id: idFor(i),
        name: `Shop ${i}`,
        score: 1000 - i,
        tier: "B",
        hours: i % 2 === 0 ? OPEN_HOURS : CLOSED_HOURS,
      });
    }

    const allIds: string[] = [];
    const openViaDecorate: string[] = [];
    const firstAll = await listLeads(db, {}, NOW);
    for (let page = 1; page <= firstAll.totalPages; page++) {
      const { leads } = await listLeads(db, {}, NOW, page);
      for (const lead of leads) {
        allIds.push(lead.id);
        if (lead.openState === "open") openViaDecorate.push(lead.id);
      }
    }
    expect(allIds).toHaveLength(total);

    const openViaPathB: string[] = [];
    const firstOpen = await listLeads(db, { openOnly: true }, NOW);
    for (let page = 1; page <= firstOpen.totalPages; page++) {
      const { leads } = await listLeads(db, { openOnly: true }, NOW, page);
      openViaPathB.push(...leads.map((l) => l.id));
    }

    expect(openViaPathB).toHaveLength(openViaDecorate.length);
    expect(new Set(openViaPathB)).toEqual(new Set(openViaDecorate));
  });

  it("keeps page/totalPages/total internally consistent across a full walk", async () => {
    const total = 44;
    for (let i = 0; i < total; i++) seed({ id: idFor(i), name: `Shop ${i}`, score: 1000 - i });

    for (let page = 1; page <= 3; page++) {
      const result = await listLeads(db, {}, NOW, page);
      expect(result.total).toBe(total);
      expect(result.totalPages).toBe(2);
      expect(result.pageSize).toBe(LEADS_PAGE_SIZE);
      expect(result.page).toBeGreaterThanOrEqual(1);
      expect(result.page).toBeLessThanOrEqual(result.totalPages);
    }
  });

  it("does not produce a trailing empty page when total is an exact multiple of the page size", async () => {
    const total = LEADS_PAGE_SIZE * 2;
    for (let i = 0; i < total; i++) seed({ id: idFor(i), name: `Shop ${i}`, score: 1000 - i });

    const page1 = await listLeads(db, {}, NOW, 1);
    const page2 = await listLeads(db, {}, NOW, 2);
    expect(page1.totalPages).toBe(2);
    expect(page2.totalPages).toBe(2);
    expect(page1.leads).toHaveLength(LEADS_PAGE_SIZE);
    expect(page2.leads).toHaveLength(LEADS_PAGE_SIZE);

    // There is no third page — asking for one clamps back to the last real page.
    const page3 = await listLeads(db, {}, NOW, 3);
    expect(page3.page).toBe(2);
    expect(page3.leads).toHaveLength(LEADS_PAGE_SIZE);
  });

  it("fills the last page only partially when total is not a multiple of the page size", async () => {
    const total = LEADS_PAGE_SIZE * 2 + 3;
    for (let i = 0; i < total; i++) seed({ id: idFor(i), name: `Shop ${i}`, score: 1000 - i });

    const last = await listLeads(db, {}, NOW, 3);
    expect(last.totalPages).toBe(3);
    expect(last.page).toBe(3);
    expect(last.leads).toHaveLength(3);
  });

  it("fills the last page only partially under open-now too (Path B)", async () => {
    const openTotal = LEADS_PAGE_SIZE + 4;
    for (let i = 0; i < openTotal; i++) {
      seed({ id: idFor(i), name: `Shop ${i}`, score: 1000 - i, hours: OPEN_HOURS });
    }
    seed({ id: idFor(999), name: "Shut", score: 1, hours: CLOSED_HOURS });

    const last = await listLeads(db, { openOnly: true }, NOW, 2);
    expect(last.totalPages).toBe(2);
    expect(last.leads).toHaveLength(4);
  });

  it("returns an empty page, not an error, when nothing matches", async () => {
    seed({ id: idFor(0), name: "Only", neighborhood: "Hialeah" });

    const page = await listLeads(db, { neighborhood: "Nowhereville" }, NOW);
    expect(page).toEqual({
      leads: [],
      page: 1,
      pageSize: LEADS_PAGE_SIZE,
      total: 0,
      totalPages: 1,
    });
  });

  it("returns an empty page under open-now when nothing is open at all", async () => {
    for (let i = 0; i < 5; i++) seed({ id: idFor(i), name: `Shop ${i}`, hours: CLOSED_HOURS });

    const page = await listLeads(db, { openOnly: true }, NOW);
    expect(page).toEqual({
      leads: [],
      page: 1,
      pageSize: LEADS_PAGE_SIZE,
      total: 0,
      totalPages: 1,
    });
    expect(await countLeads(db, { openOnly: true }, NOW)).toBe(0);
  });

  it("pages a single matching lead correctly", async () => {
    seed({ id: idFor(0), name: "Solo", neighborhood: "Doral" });
    seed({ id: idFor(1), name: "Other", neighborhood: "Hialeah" });

    const page = await listLeads(db, { neighborhood: "Doral" }, NOW);
    expect(page.total).toBe(1);
    expect(page.totalPages).toBe(1);
    expect(page.page).toBe(1);
    expect(page.leads.map((l) => l.id)).toEqual([idFor(0)]);
  });

  it("serves the last real page, not an error, for a page number beyond totalPages (doc example: page 99 of 6)", async () => {
    const total = 137; // ceil(137 / 25) === 6, last page carries the remaining 12
    for (let i = 0; i < total; i++) seed({ id: idFor(i), name: `Shop ${i}`, score: 1000 - i });

    const page = await listLeads(db, {}, NOW, 99);
    expect(page.totalPages).toBe(6);
    expect(page.page).toBe(6);
    expect(page.leads).toHaveLength(12);
  });

  it("clamps a page number beyond totalPages under open-now too (Path B)", async () => {
    for (let i = 0; i < 30; i++) {
      seed({ id: idFor(i), name: `Shop ${i}`, score: 1000 - i, hours: OPEN_HOURS });
    }

    const page = await listLeads(db, { openOnly: true }, NOW, 50);
    expect(page.totalPages).toBe(2);
    expect(page.page).toBe(2);
    expect(page.leads).toHaveLength(5);
  });

  it("reproduces the same page for the same filters, page and clock (deep link stability)", async () => {
    for (let i = 0; i < 40; i++) {
      seed({
        id: idFor(i),
        name: `Shop ${i}`,
        score: 1000 - i,
        tier: i % 2 === 0 ? "A" : "B",
        hours: i % 3 === 0 ? OPEN_HOURS : CLOSED_HOURS,
      });
    }

    const filters: LeadFilters = { tiers: ["A", "B"], openOnly: true };
    const first = await listLeads(db, filters, NOW, 2);
    const second = await listLeads(db, filters, NOW, 2);
    expect(second).toEqual(first);
  });

  it("keeps two leads tied on tier/score/review_count in id order, even straddling a page boundary under open-now", async () => {
    for (let i = 0; i < 24; i++) {
      seed({ id: idFor(i), name: `Shop ${i}`, score: 1000 - i, tier: "A", hours: OPEN_HOURS });
    }
    seed({
      id: idFor(9001),
      name: "TiedHigh",
      tier: "A",
      score: 500,
      reviewCount: 50,
      hours: OPEN_HOURS,
    });
    seed({
      id: idFor(9002),
      name: "TiedLow",
      tier: "A",
      score: 500,
      reviewCount: 50,
      hours: OPEN_HOURS,
    });
    const tiedIds = [idFor(9001), idFor(9002)].sort();

    const page1 = await listLeads(db, { openOnly: true }, NOW, 1);
    const page2 = await listLeads(db, { openOnly: true }, NOW, 2);

    expect(page1.total).toBe(26);
    expect(page1.leads).toHaveLength(25);
    expect(page2.leads).toHaveLength(1);
    expect(page1.leads[24]?.id).toBe(tiedIds[0]);
    expect(page2.leads[0]?.id).toBe(tiedIds[1]);
  });

  it("countLeads under open-now matches listLeads's total exactly — the bug this design fixes", async () => {
    for (let i = 0; i < 60; i++) {
      seed({
        id: idFor(i),
        name: `Shop ${i}`,
        score: 1000 - i,
        hours: i % 4 === 0 ? CLOSED_HOURS : OPEN_HOURS,
      });
    }

    const filters: LeadFilters = { openOnly: true };
    const listed = await listLeads(db, filters, NOW);
    const counted = await countLeads(db, filters, NOW);
    expect(counted).toBe(listed.total);
    expect(counted).toBeGreaterThan(0);
  });
});

describe("parsePageParam", () => {
  const cases: [string | undefined, number][] = [
    [undefined, 1],
    ["", 1],
    ["abc", 1],
    ["1.5", 1],
    ["1e10", 1],
    [" 2", 1],
    ["-1", 1],
    ["0", 1],
    ["1", 1],
    ["5", 5],
    ["007", 7],
    ["100000", 100000],
    ["+3", 1],
    ["3 ", 1],
    ["٣", 1], // Arabic-Indic digit — `\d` outside unicode mode only matches ASCII 0-9
    ["99999999999999999999", 1e20],
  ];

  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)} as ${expected}`, () => {
      expect(parsePageParam(input)).toBe(expected);
    });
  }
});

// Independent of `leads.ts`'s own SQL and `ORDER_BY` — reads every row straight out of SQLite and
// re-applies each filter and the tiebreak with a hand-written comparator, so a bug that made the
// module agree with itself (e.g. `COUNT(*)` and the page silently using different predicates)
// cannot also fool this check.
const TIER_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };

function independentOracle(filters: LeadFilters, now: Date, openIds: Set<string> | null): string[] {
  const rows = sqlite
    .query(
      "SELECT l.*, s.outcome, s.next_followup FROM leads l JOIN lead_state s ON s.lead_id = l.id",
    )
    .all() as Array<Record<string, string | number | null>>;
  const day = now.toISOString().slice(0, 10);

  return rows
    .filter((r) => (filters.neighborhood ? r.neighborhood === filters.neighborhood : true))
    .filter((r) => (filters.tiers ? filters.tiers.includes(String(r.tier) as Tier) : true))
    .filter((r) => (filters.es ? r.es_strength === filters.es : true))
    .filter((r) => {
      if (filters.outcome === "queue") {
        return (
          r.outcome === "new" ||
          (r.outcome === "callback" && String(r.next_followup ?? "9999-99-99") <= day)
        );
      }
      if (filters.outcome) return r.outcome === filters.outcome;
      return true;
    })
    .filter((r) => (openIds ? openIds.has(String(r.id)) : true))
    .filter((r) =>
      filters.channel === "walk"
        ? Number(r.is_mobile) === 0 && String(r.address ?? "").trim() !== ""
        : true,
    )
    .filter((r) => (filters.zip === undefined ? true : Number(r.zip) === filters.zip))
    .sort((a, b) => {
      if (filters.channel === "walk") {
        // NULL ZIPs last, then block by block.
        const zipA = a.zip === null ? Number.POSITIVE_INFINITY : Number(a.zip);
        const zipB = b.zip === null ? Number.POSITIVE_INFINITY : Number(b.zip);
        if (zipA !== zipB) return zipA - zipB;
      }
      const rankA = TIER_RANK[String(a.tier)] ?? 3;
      const rankB = TIER_RANK[String(b.tier)] ?? 3;
      if (rankA !== rankB) return rankA - rankB;
      if (a.score !== b.score) return Number(b.score) - Number(a.score);
      if (filters.channel !== "walk" && a.review_count !== b.review_count) {
        return Number(b.review_count) - Number(a.review_count);
      }
      return String(a.id) < String(b.id) ? -1 : 1;
    })
    .map((r) => String(r.id));
}

async function pageThroughAll(
  filters: LeadFilters,
  now: Date,
): Promise<{ ids: string[]; total: number; totalPages: number }> {
  const first = await listLeads(db, filters, now, 1);
  const ids: string[] = [];
  for (let page = 1; page <= first.totalPages; page++) {
    const got = await listLeads(db, filters, now, page);
    expect(got.total).toBe(first.total);
    expect(got.totalPages).toBe(first.totalPages);
    expect(got.page).toBe(page);
    expect(got.leads.length).toBeLessThanOrEqual(LEADS_PAGE_SIZE);
    ids.push(...got.leads.map((l) => l.id));
  }
  return { ids, total: first.total, totalPages: first.totalPages };
}

describe("pagination cross-checked against an independent oracle", () => {
  it("boundary totals of 0, 1, 24, 25, 26, 50 and 51 all page without gaps or duplicates", async () => {
    for (const n of [0, 1, 24, 25, 26, 50, 51]) {
      sqlite = new Database(":memory:");
      sqlite.run(SCHEMA);
      db = d1(sqlite);
      for (let i = 0; i < n; i++) seed({ id: idFor(i), name: `Shop ${i}` });

      const { ids, total, totalPages } = await pageThroughAll({}, NOW);
      expect(total).toBe(n);
      expect(totalPages).toBe(Math.max(1, Math.ceil(n / LEADS_PAGE_SIZE)));
      expect(new Set(ids).size).toBe(n);
      expect(ids).toEqual(independentOracle({}, NOW, null));
    }
  });

  it("60 leads tied on tier/score/review_count still page cleanly, ordered only by id", async () => {
    for (let i = 0; i < 60; i++) {
      seed({ id: idFor(i), name: `Shop ${i}`, tier: "B", score: 7, reviewCount: 100 });
    }

    const { ids, total } = await pageThroughAll({}, NOW);
    expect(total).toBe(60);
    expect(new Set(ids).size).toBe(60);
    expect(ids).toEqual(independentOracle({}, NOW, null));
    expect(ids).toEqual([...ids].sort());
  });

  it("every one of 144 filter combinations matches the oracle, with countLeads agreeing on each", async () => {
    const openIds = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const isOpen = i % 5 !== 0 && i % 5 !== 1;
      const id = idFor(i);
      seed({
        id,
        name: `Shop ${i}`,
        tier: ["A", "B", "C", "X"][i % 4],
        score: i % 6,
        reviewCount: i % 9,
        neighborhood: ["Hialeah", "Wynwood", "Doral"][i % 3],
        esStrength: ["strong", "weak", "none"][i % 3],
        outcome: ["new", "no_answer", "interested", "callback"][i % 4],
        nextFollowup: "2026-08-01",
        // Path B has to treat a lead with unparsable/absent hours as not-open, same as Path A's
        // per-row `decorate()` would — folded in here rather than a separate test.
        hours: i % 5 === 0 ? CLOSED_HOURS : i % 5 === 1 ? null : OPEN_HOURS,
        // Every shape the route has to survive: no address, a blank one, a van, and rows sharing a
        // ZIP so the block ordering has ties to break.
        address: i % 11 === 0 ? null : i % 11 === 1 ? "  " : `${i} Main St`,
        zip: i % 7 === 0 ? null : 6600 + (i % 4),
        isMobile: i % 13 === 0,
      });
      if (isOpen) openIds.add(id);
    }

    const neighborhoods = [undefined, "Wynwood"] as const;
    const tierSets: (LeadFilters["tiers"] | undefined)[] = [undefined, ["A", "B"], ["X"]];
    const esValues = [undefined, "strong"] as const;
    const outcomes = [undefined, "queue", "interested"] as const;
    const openOnlyValues = [false, true] as const;
    const channels = [undefined, "walk"] as const;

    const combos: LeadFilters[] = [];
    for (const neighborhood of neighborhoods) {
      for (const tiers of tierSets) {
        for (const es of esValues) {
          for (const outcome of outcomes) {
            for (const openOnly of openOnlyValues) {
              for (const channel of channels) {
                combos.push({ neighborhood, tiers, es, outcome, openOnly, channel });
              }
            }
          }
        }
      }
    }
    expect(combos.length).toBe(144);

    for (const filters of combos) {
      const { ids, total } = await pageThroughAll(filters, NOW);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(total);
      expect(ids).toEqual(independentOracle(filters, NOW, filters.openOnly ? openIds : null));
      expect(await countLeads(db, filters, NOW)).toBe(total);
    }
  });
});

// PR #68 shipped because an earlier version of this query layer ran the expensive part of
// `decorate()` over every SQL-matching row instead of just the current page, and blew the Workers
// Free plan's 10ms CPU budget (see docs/api/sales-pagination.md). `leads.length <= pageSize` alone
// cannot catch a regression back to that shape, because a naive fetch-everything-then-slice
// implementation would still return a page-sized array — the row volume has to be checked at the
// database boundary itself, not at `listLeads`'s return value.
describe("row-volume guard against re-decorating the whole table", () => {
  type LoggedRow = Record<string, unknown>;
  let log: Array<{ rows: number; cols: string[] }>;
  let bigDb: D1Database;

  function instrumentedD1(rawDb: Database): D1Database {
    const prepare = (sql: string, binds: unknown[] = []) => ({
      bind: (...next: unknown[]) => prepare(sql, next),
      all: async () => {
        const results = rawDb.query(sql).all(...(binds as never[])) as LoggedRow[];
        log.push({ rows: results.length, cols: results[0] ? Object.keys(results[0]) : [] });
        return { results };
      },
      first: async () => {
        const row = (rawDb.query(sql).get(...(binds as never[])) as LoggedRow | null) ?? null;
        log.push({ rows: row ? 1 : 0, cols: row ? Object.keys(row) : [] });
        return row;
      },
      run: async () => ({ success: true }),
    });
    return { prepare: (sql: string) => prepare(sql) } as unknown as D1Database;
  }

  beforeEach(() => {
    log = [];
    const raw = new Database(":memory:");
    raw.run(SCHEMA);
    for (let i = 0; i < 400; i++) {
      const id = idFor(i);
      raw.run(
        `INSERT INTO leads (id, shop_name, phone_e164, slug, neighborhood, hours, review_count,
           is_mobile, is_chain, booking_app, es_strength, price_confidence, score, tier, imported_at)
         VALUES (?, ?, ?, ?, 'Hialeah', ?, 10, 0, 0, 'none', 'none', 'low', 5, 'B', '2026-07-30T00:00:00Z')`,
        [id, `Shop ${i}`, `+1305${id.slice(-7)}`, `slug-${i}`, OPEN_HOURS],
      );
      raw.run("INSERT INTO lead_state (lead_id, updated_at) VALUES (?, '2026-07-30T00:00:00Z')", [
        id,
      ]);
    }
    bigDb = instrumentedD1(raw);
  });

  it("Path A never returns a full-column row set larger than one page, even across 400 rows", async () => {
    const page = await listLeads(bigDb, {}, NOW, 3);
    expect(page.total).toBe(400);
    expect(page.leads).toHaveLength(LEADS_PAGE_SIZE);

    for (const q of log.filter((entry) => entry.cols.includes("shop_name"))) {
      expect(q.rows).toBeLessThanOrEqual(LEADS_PAGE_SIZE);
    }
  });

  it("Path B's whole-table pass never carries full lead columns, and full rows never exceed one page", async () => {
    const page = await listLeads(bigDb, { openOnly: true }, NOW, 3);
    expect(page.total).toBe(400);
    expect(page.leads).toHaveLength(LEADS_PAGE_SIZE);

    const wide = log.filter((entry) => entry.rows > LEADS_PAGE_SIZE);
    expect(wide.length).toBeGreaterThan(0);
    for (const q of wide) {
      // The only query allowed to touch every matching row is the id/hours-only pass — if it ever
      // carries the columns `decorate()` needs, the expensive query is back.
      expect(q.cols).not.toContain("shop_name");
    }

    for (const q of log.filter((entry) => entry.cols.includes("shop_name"))) {
      expect(q.rows).toBeLessThanOrEqual(LEADS_PAGE_SIZE);
    }
  });

  it("countLeads under open-now never fetches a full lead row at all", async () => {
    const total = await countLeads(bigDb, { openOnly: true }, NOW);
    expect(total).toBe(400);
    expect(log.filter((entry) => entry.cols.includes("shop_name"))).toEqual([]);
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

  // "Left to visit" counting doors that are not there is the same bug as a header saying 119 above
  // a list of 20.
  it("leaves vans and address-less leads out of the count on a route", async () => {
    seed({ id: "3051110001", name: "Shop", address: "1 Main St" });
    seed({ id: "3051110002", name: "Van", address: "2 Main St", isMobile: true });
    seed({ id: "3051110003", name: "Nowhere", address: null });

    expect((await counters(db, new Date())).queue).toBe(3);
    expect((await counters(db, new Date(), { channel: "walk" })).queue).toBe(1);
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

describe("getLeadBySlug", () => {
  it("finds a lead by the slug its own page is addressed by", async () => {
    seed({ id: "3051110001", name: "Happy Paws" });

    const lead = await getLeadBySlug(db, "happy-paws");
    expect(lead?.id).toBe("3051110001");
    expect(lead?.shop_name).toBe("Happy Paws");
  });

  it("returns null for a slug the last import dropped", async () => {
    seed({ id: "3051110001", name: "Happy Paws" });

    expect(await getLeadBySlug(db, "gone-grooming")).toBeNull();
  });
});

describe("neighbours", () => {
  it("steps through the call queue in the order the queue itself uses", async () => {
    seed({ id: "3051110001", name: "First", tier: "A", score: 12 });
    seed({ id: "3051110002", name: "Second", tier: "B", score: 8 });
    seed({ id: "3051110003", name: "Third", tier: "C", score: 2 });

    const middle = await neighbours(db, {}, "3051110002");
    expect(middle).toMatchObject({ index: 1, total: 3 });
    expect(middle.prev?.slug).toBe("first");
    expect(middle.next?.slug).toBe("third");

    expect((await neighbours(db, {}, "3051110001")).prev).toBeNull();
    expect((await neighbours(db, {}, "3051110003")).next).toBeNull();
  });

  it("walks a route block by block, not by score", async () => {
    seed({
      id: "3051110001",
      name: "Far best",
      tier: "A",
      score: 14,
      address: "1 A St",
      zip: 6615,
    });
    seed({
      id: "3051110002",
      name: "Near weak",
      tier: "C",
      score: 3,
      address: "2 B St",
      zip: 6604,
    });
    seed({
      id: "3051110003",
      name: "Near best",
      tier: "A",
      score: 11,
      address: "3 B St",
      zip: 6604,
    });

    const steps = await neighbours(db, { channel: "walk" }, "3051110002");
    expect(steps.prev?.shop_name).toBe("Near best");
    expect(steps.next?.shop_name).toBe("Far best");
    expect(steps).toMatchObject({ index: 1, total: 3 });
  });

  // Marking a lead `interested` drops it out of the default queue while the rep is still on its
  // page. Arrows built from a list this lead is no longer on would step somewhere arbitrary.
  it("gives no arrows for a lead outside the filters it is viewed under", async () => {
    seed({ id: "3051110001", name: "Queued" });
    seed({ id: "3051110002", name: "Interested", outcome: "interested" });

    const steps = await neighbours(db, { outcome: "queue" }, "3051110002");
    expect(steps).toEqual({ prev: null, next: null, index: -1, total: 1 });
  });

  it("skips the shops the open-now filter hides", async () => {
    seed({ id: "3051110001", name: "Open one", tier: "A", score: 12, hours: OPEN_HOURS });
    seed({ id: "3051110002", name: "Shut", tier: "B", score: 8, hours: CLOSED_HOURS });
    seed({ id: "3051110003", name: "Open two", tier: "C", score: 2, hours: OPEN_HOURS });

    const steps = await neighbours(db, { openOnly: true }, "3051110001", NOW);
    expect(steps.next?.shop_name).toBe("Open two");
    expect(steps.total).toBe(2);
  });
});

describe("saveResearch", () => {
  it("stores the write-up and logs who wrote it", async () => {
    seed({ id: "3051110001", name: "Shop" });

    await saveResearch(db, "3051110001", "  No booking page. IG dead since May.  ", "Marco");

    const lead = await getLead(db, "3051110001");
    expect(lead?.research).toBe("No booking page. IG dead since May.");

    const history = await leadHistory(db, "3051110001");
    expect(history[0]).toMatchObject({ actor: "Marco", note: "doc updated" });
  });

  it("clears the doc on an empty submission", async () => {
    seed({ id: "3051110001", name: "Shop" });

    await saveResearch(db, "3051110001", "something", "Marco");
    await saveResearch(db, "3051110001", "   ", "Marco");

    expect((await getLead(db, "3051110001"))?.research).toBeNull();
    expect((await leadHistory(db, "3051110001"))[0]?.note).toBe("doc cleared");
  });

  // Two different fields on purpose: `note` is the line that goes out with a call result, and a
  // pasted doc would bury it in the queue.
  it("leaves the call result and its note alone", async () => {
    seed({ id: "3051110001", name: "Shop" });

    await recordOutcome(db, "3051110001", {
      outcome: "callback",
      actor: "Marco",
      note: "asked for Tuesday",
    });
    await saveResearch(db, "3051110001", "needs a website", "Marco");

    const lead = await getLead(db, "3051110001");
    expect(lead?.outcome).toBe("callback");
    expect(lead?.note).toBe("asked for Tuesday");
    expect(lead?.attempts).toBe(1);
  });
});

describe("salons and vans are two lists", () => {
  // The split the filter bar makes: a van has no door to walk into, and `is_mobile` is worth +4, so
  // left in the salon list it would sit on top of every route.
  it("keeps vans out of the salon list in a dialled area too", async () => {
    seed({ id: "3051110001", name: "Van", tier: "A", score: 12, isMobile: true });
    seed({ id: "3051110002", name: "Shop", tier: "B", score: 8 });

    const salons = await listLeads(db, { mobile: false });
    expect(salons.leads.map((l) => l.shop_name)).toEqual(["Shop"]);

    const vans = await listLeads(db, { mobile: true });
    expect(vans.leads.map((l) => l.shop_name)).toEqual(["Van"]);
  });

  it("counts the same split the list shows", async () => {
    seed({ id: "3051110001", name: "Van", isMobile: true });
    seed({ id: "3051110002", name: "Shop A", address: "1 Main St" });
    seed({ id: "3051110003", name: "Shop B", address: "2 Main St" });

    expect((await counters(db, new Date(), { mobile: false })).queue).toBe(2);
    expect((await counters(db, new Date(), { mobile: true })).queue).toBe(1);
  });

  // A van with no address still has to be reachable — it was only ever workable by phone.
  it("lists an address-less van, which the route would have dropped", async () => {
    seed({ id: "3051110001", name: "Roaming", address: null, isMobile: true });

    expect((await listLeads(db, { mobile: true, channel: "call" })).total).toBe(1);
    expect((await listLeads(db, { mobile: false, channel: "walk" })).total).toBe(0);
  });
});
