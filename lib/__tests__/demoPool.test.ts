import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { DEMO_SERVICES } from "@/lib/demoServices";
import {
  type DemoPoolEnv,
  assignNumber,
  poolStatus,
  releaseForLead,
  sweepDemoPool,
} from "@/lib/sales/demoPool";

// Same real-SQLite shim as the leads tests: schema drift and SQL mistakes have to fail here, not
// on a call the rep is in the middle of.
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
${await Bun.file("d1/0004_walk_route.sql").text()}`;

let sqlite: Database;
let patched: { shopId: string; update: Record<string, unknown> }[];
let calls: { startedAt: string; endedAt: string | null }[];
let alerts: string[];

// The pool talks to three outside systems; each is replaced by the smallest thing that still
// exercises the ordering we care about (claim → rewrite → publish).
function makeEnv(overrides: Partial<DemoPoolEnv> = {}): DemoPoolEnv {
  return {
    OUTREACH_DB: d1(sqlite),
    VOICE_AGENT_API_URL: "https://voice-agent.test",
    ADMIN_API_KEY: "test-key",
    TWILIO_ACCOUNT_SID: "AC-test",
    TWILIO_AUTH_TOKEN: "token",
    RESEND_API_KEY: "re_test",
    LEAD_NOTIFY_EMAIL: "team@test",
    DEMO_POOL_AGENT_ID: "agent_en",
    ...overrides,
  };
}

const lead = {
  id: "13051112222",
  shop_name: "Rose's Grooming House",
  hours:
    "Monday: 9:00 AM \u2013 6:00 PM | Tuesday: 9:00 AM \u2013 6:00 PM | " +
    "Wednesday: 9:00 AM \u2013 6:00 PM | Thursday: 9:00 AM \u2013 6:00 PM | " +
    "Friday: 9:00 AM \u2013 6:00 PM | Saturday: 10:00 AM \u2013 4:00 PM | Sunday: Closed",
  address: "1165 W 49th St, Hialeah, FL 33012",
};

function seedLead() {
  sqlite.run(
    `INSERT INTO leads (id, shop_name, phone_e164, slug, imported_at)
     VALUES (?, ?, '+13051112222', 'roses-grooming-house', '2026-08-03T00:00:00.000Z')`,
    [lead.id, lead.shop_name],
  );
  sqlite.run(
    "INSERT INTO lead_state (lead_id, updated_at) VALUES (?, '2026-08-03T00:00:00.000Z')",
    [lead.id],
  );
}

// A lead whose website we managed to read. `high` is the only confidence that reaches the agent.
function seedEnrichment(confidence = "high") {
  sqlite.run(
    `INSERT INTO lead_enrichment (lead_id, services, service_confidence, fetched_at)
     VALUES (?, ?, ?, '2026-08-06T00:00:00.000Z')`,
    [
      lead.id,
      JSON.stringify([
        {
          name: "Full Groom",
          durationMin: "60",
          durationMaxMin: "150",
          price: "70",
          priceMax: "130",
        },
        { name: "Nail Trim", durationMin: "15", price: "18" },
      ]),
      confidence,
    ],
  );
}

function seedNumbers(count: number) {
  for (let i = 0; i < count; i++) {
    sqlite.run(
      `INSERT INTO demo_numbers (phone_e164, twilio_sid, shop_id, state, updated_at)
       VALUES (?, ?, ?, 'idle', ?)`,
      [`+1786000000${i}`, `PN${i}`, `shop-${i}`, `2026-08-0${i + 1}T00:00:00.000Z`],
    );
  }
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.run(SCHEMA);
  patched = [];
  calls = [];
  alerts = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/admin/shops/")) {
      patched.push({
        shopId: url.split("/admin/shops/")[1],
        update: JSON.parse(String(init?.body ?? "{}")),
      });
      return new Response("{}", { status: 200 });
    }
    if (url.includes("/Calls.json")) {
      return Response.json({
        calls: calls.map((c) => ({ start_time: c.startedAt, end_time: c.endedAt })),
      });
    }
    if (url.includes("api.resend.com")) {
      alerts.push(JSON.parse(String(init?.body ?? "{}")).subject);
      return Response.json({ id: "email" });
    }
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;
});

describe("assignNumber", () => {
  it("leases a number and rewrites the shop to answer as the prospect's salon", async () => {
    seedLead();
    seedNumbers(2);

    const result = await assignNumber(makeEnv(), lead, "en");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.number.phone_e164).toBe("+17860000000");
    expect(patched).toHaveLength(1);

    const { shopId, update } = patched[0];
    expect(shopId).toBe("shop-0");
    expect(update.name).toBe(lead.shop_name);
    expect(update.elevenlabs_agent_id).toBe("agent_en");
    expect(update.primary_language).toBe("en");
    // Their own street, not the demo shop's — the agent states an address as fact.
    expect(update.address).toBe(lead.address);
    expect(JSON.parse(update.hours_json as string)).toMatchObject({
      Mon: "9:00am-6:00pm",
      Sun: "closed",
    });
  });

  it("quotes the site's own prices when the scrape is trustworthy", () => {
    seedLead();
    seedEnrichment("high");
    seedNumbers(1);

    return assignNumber(makeEnv(), lead, "en").then(() => {
      expect(JSON.parse(patched[0].update.services_json as string)).toEqual([
        "Full Groom — 60-150 min / $70-130",
        "Nail Trim — 15 min / $18",
      ]);
    });
  });

  it("sends the reviewed menu rather than nothing when there is no trustworthy scrape", async () => {
    // Omitting `services_json` would leave whatever the recycled shop last held, and the agent is
    // now told to read a listed price aloud — so silence here means quoting someone else's prices.
    seedLead();
    seedEnrichment("low");
    seedNumbers(1);

    await assignNumber(makeEnv(), lead, "en");

    const menu = JSON.parse(patched[0].update.services_json as string) as string[];
    expect(menu.length).toBe(DEMO_SERVICES.grooming.length);
    expect(menu.some((s) => s.startsWith("Full Groom —"))).toBe(true);
  });

  it("still generates a demo for a lead with no hours, address or enrichment", async () => {
    seedLead();
    seedNumbers(1);

    const result = await assignNumber(makeEnv(), { id: lead.id, shop_name: lead.shop_name }, "en");

    expect(result.ok).toBe(true);
    // Hours are the one field allowed to be absent: a bad value there is rejected server-side and
    // would fail the whole generation.
    expect("hours_json" in patched[0].update).toBe(false);
    expect(patched[0].update.address).toBeNull();
    expect(patched[0].update.services_json).toBeDefined();
  });

  it("is idempotent per lead, so a double-clicked button leases one number", async () => {
    seedLead();
    seedNumbers(3);
    const env = makeEnv();

    const first = await assignNumber(env, lead, "en");
    const second = await assignNumber(env, lead, "en");

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.number.phone_e164).toBe(first.number.phone_e164);
    expect((await poolStatus(d1(sqlite))).free).toBe(2);
  });

  it("reports a full pool instead of stealing a live number", async () => {
    seedLead();
    sqlite.run(
      `INSERT INTO demo_numbers (phone_e164, twilio_sid, shop_id, state, lead_id, expires_at, updated_at)
       VALUES ('+17860000000', 'PN0', 'shop-0', 'assigned', 'other-lead', '2099-01-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
    );

    const result = await assignNumber(makeEnv(), lead, "en");

    expect(result).toMatchObject({ ok: false, reason: "pool_full" });
    expect(patched).toEqual([]);
  });

  it("rolls the claim back when the shop cannot be rewritten", async () => {
    seedLead();
    seedNumbers(1);
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).includes("/admin/shops/")
        ? new Response("nope", { status: 500 })
        : new Response("{}")) as typeof fetch;

    const result = await assignNumber(makeEnv(), lead, "en");

    expect(result).toMatchObject({ ok: false, reason: "failed" });
    expect((await poolStatus(d1(sqlite))).free).toBe(1);
  });

  it("falls back to the English clone when no Spanish one is configured", async () => {
    seedLead();
    seedNumbers(1);

    await assignNumber(makeEnv({ DEMO_POOL_AGENT_ID_ES: "" }), lead, "es");

    expect(patched[0].update.elevenlabs_agent_id).toBe("agent_en");
  });
});

describe("release and sweep", () => {
  it("returns the shop to the neutral demo when the rep frees a number", async () => {
    seedLead();
    seedNumbers(1);
    const env = makeEnv();
    await assignNumber(env, lead, "en");

    await releaseForLead(env, lead.id);

    const reset = patched.at(-1);
    expect(reset?.shopId).toBe("shop-0");
    expect(reset?.update).toMatchObject({
      name: "Marisol Demo",
      elevenlabs_agent_id: "agent_en",
      primary_language: "en",
      address: "210 Coral Way, Miami, FL 33145",
    });
    // Every field the assign could set has to come back, or the next prospect inherits the last
    // one's hours and price list on a recycled number.
    expect(JSON.parse(reset?.update.hours_json as string)).toEqual({
      "Mon-Fri": "8am-6pm",
      Sat: "9am-4pm",
    });
    expect(JSON.parse(reset?.update.services_json as string).length).toBe(
      DEMO_SERVICES.grooming.length,
    );
    expect((await poolStatus(d1(sqlite))).free).toBe(1);
  });

  it("expires an uncalled demo once its TTL passes", async () => {
    seedLead();
    seedNumbers(1);
    const env = makeEnv();
    await assignNumber(env, lead, "en", new Date("2026-08-03T08:00:00.000Z"));

    await sweepDemoPool(env, new Date("2026-08-03T19:00:00.000Z"));
    expect((await poolStatus(d1(sqlite))).free).toBe(0);

    await sweepDemoPool(env, new Date("2026-08-03T21:00:00.000Z"));
    expect((await poolStatus(d1(sqlite))).free).toBe(1);
  });

  it("records the call, holds the number through grace, and alerts the team", async () => {
    seedLead();
    seedNumbers(1);
    const env = makeEnv();
    await assignNumber(env, lead, "en", new Date("2026-08-03T08:00:00.000Z"));
    calls = [{ startedAt: "2026-08-03T09:00:00.000Z", endedAt: "2026-08-03T09:03:00.000Z" }];

    await sweepDemoPool(env, new Date("2026-08-03T09:05:00.000Z"));

    const row = sqlite.query("SELECT * FROM demo_numbers").get() as Row;
    expect(row.state).toBe("grace");
    expect(row.called_at).toBe("2026-08-03T09:00:00.000Z");
    expect(alerts[0]).toContain("Demo called");

    const state = sqlite.query("SELECT demo_called_at FROM lead_state").get() as Row;
    expect(state.demo_called_at).toBe("2026-08-03T09:00:00.000Z");

    // Owners ring back to show someone, so the number is still theirs inside the grace window.
    await sweepDemoPool(env, new Date("2026-08-03T09:30:00.000Z"));
    expect((await poolStatus(d1(sqlite))).free).toBe(0);

    await sweepDemoPool(env, new Date("2026-08-03T10:30:00.000Z"));
    expect((await poolStatus(d1(sqlite))).free).toBe(1);
  });

  it("never throws when the pool table is unreachable", async () => {
    const env = makeEnv({ OUTREACH_DB: undefined });
    expect(await sweepDemoPool(env)).toBeUndefined();
  });
});
