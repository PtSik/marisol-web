import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
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
${await Bun.file("d1/0002_demo_pool.sql").text()}`;

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

const lead = { id: "13051112222", shop_name: "Rose's Grooming House" };

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
  it("leases a number and renames the shop to the prospect's salon", async () => {
    seedLead();
    seedNumbers(2);

    const result = await assignNumber(makeEnv(), lead, "en");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.number.phone_e164).toBe("+17860000000");
    expect(patched).toEqual([
      { shopId: "shop-0", update: { name: lead.shop_name, elevenlabs_agent_id: "agent_en" } },
    ]);
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

    expect(patched.at(-1)).toEqual({
      shopId: "shop-0",
      update: { name: "Marisol Demo", elevenlabs_agent_id: "agent_en" },
    });
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
