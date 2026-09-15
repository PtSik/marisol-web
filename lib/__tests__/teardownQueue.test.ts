import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { enqueueSubscriptionCancellation, runCancellationJobs } from "@/lib/cancellation";
import type { CheckoutLead } from "@/lib/leads";
import {
  claimTeardown,
  enqueueTeardown,
  finishTeardown,
  listTeardowns,
  resolveTeardown,
  retryTeardown,
} from "@/lib/teardownQueue";

let sqlite: Database;
let db: D1Database;
const originalFetch = globalThis.fetch;
beforeEach(async () => {
  sqlite = new Database(":memory:");
  sqlite.run(await Bun.file("d1/migrations/0007_teardown_jobs.sql").text());
  sqlite.run(await Bun.file("d1/migrations/0008_teardown_manual_resolution.sql").text());
  interface Statement {
    bind(...next: unknown[]): Statement;
    first(): Promise<unknown>;
    all(): Promise<{ results: unknown[] }>;
    run(): Promise<{ success: boolean }>;
  }
  const prepare = (sql: string, values: unknown[] = []): Statement => ({
    bind: (...next: unknown[]) => prepare(sql, next),
    first: async () => sqlite.query(sql).get(...(values as never[])),
    all: async () => ({ results: sqlite.query(sql).all(...(values as never[])) }),
    run: async () => {
      sqlite.query(sql).run(...(values as never[]));
      return { success: true };
    },
  });
  db = { prepare } as unknown as D1Database;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  sqlite.close();
});

describe("durable teardown", () => {
  it("deduplicates delivery, excludes concurrent claims, and never reopens completed work", async () => {
    await enqueueTeardown(db, "shop:1", "resource", { numberSid: "PN1" });
    await enqueueTeardown(db, "shop:1", "resource", { numberSid: "PN2" });
    const job = await claimTeardown(db, 1);
    if (!job) throw new Error("Expected a claimed job");
    expect(JSON.parse(job.payload).numberSid).toBe("PN1");
    expect(await claimTeardown(db, 1)).toBeNull();
    await finishTeardown(db, job, undefined, 2);
    await enqueueTeardown(db, "shop:1", "resource", {});
    expect(await claimTeardown(db, 99999999)).toBeNull();
  });
  it("recovers a crashed worker and ignores completion from an expired lease", async () => {
    await enqueueTeardown(db, "shop:1", "resource", {});
    const old = await claimTeardown(db, 1);
    if (!old) throw new Error("Expected a claimed job");
    const next = await claimTeardown(db, 600002);
    if (!next) throw new Error("Expected a recovered job");
    expect(next.token).not.toBe(old.token);
    await finishTeardown(db, old, undefined, 600003);
    expect((await listTeardowns(db))[0].status).toBe("running");
    await finishTeardown(db, next, "Twilio unavailable", 600004);
    expect(await claimTeardown(db, 600005)).toBeNull();
    await retryTeardown(db, next.id);
    expect(await claimTeardown(db, 600005)).not.toBeNull();
  });
  it("persists discovery and retries every salon after Twilio failure, independent of webhook replay", async () => {
    const leads = new Map<string, CheckoutLead>();
    for (const n of [1, 2])
      leads.set(`lead:${n}`, {
        id: String(n),
        status: "provisioned",
        shopId: `shop-${n}`,
        accountId: "account",
        assignedNumber: `+1305555012${n}`,
        twilioNumberSid: `PN${n}`,
        stripeSubscriptionId: "sub",
        basics: { businessName: "Salon" },
      } as CheckoutLead);
    const env = {
      OUTREACH_DB: db,
      LEADS_KV: {
        get: async (key: string) =>
          key === "shopLead:shop-2" ? "2" : structuredClone(leads.get(key)),
        put: async (key: string, value: string) => {
          leads.set(key, JSON.parse(value));
        },
      } as unknown as KVNamespace,
      VOICE_AGENT_API_URL: "https://voice.test",
      ADMIN_API_KEY: "key",
      TWILIO_ACCOUNT_SID: "AC",
      TWILIO_AUTH_TOKEN: "token",
    };
    let fail = true;
    let listingUnavailable = true;
    const deleted: string[] = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (init?.method === "DELETE") {
        if (fail) return new Response(null, { status: 503 });
        deleted.push(url);
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/account/shops") && listingUnavailable)
        return new Response(null, { status: 503 });
      if (url.endsWith("/account/shops"))
        return Response.json({
          shops: [
            { id: "shop-1", status: "active" },
            { id: "shop-2", status: "active" },
          ],
        });
      return Response.json({ shop: { id: "shop-1", account_id: "account" } });
    }) as typeof fetch;
    await enqueueSubscriptionCancellation(env, {
      leadId: "1",
      subscriptionId: "sub",
      reason: "Cancelled",
    });
    await runCancellationJobs(env);
    expect((await listTeardowns(db)).length).toBe(2);
    expect(leads.get("lead:1")?.status).toBe("cancellation_pending");
    expect((await listTeardowns(db)).some((job) => job.kind === "subscription")).toBe(true);
    listingUnavailable = false;
    for (const job of await listTeardowns(db)) await retryTeardown(db, job.id);
    await runCancellationJobs(env);
    expect((await listTeardowns(db)).every((job) => job.kind === "resource")).toBe(true);
    expect((await listTeardowns(db)).length).toBe(2);
    fail = false;
    for (const job of await listTeardowns(db)) await retryTeardown(db, job.id);
    await runCancellationJobs(env);
    expect(await listTeardowns(db)).toHaveLength(0);
    expect(deleted).toHaveLength(2);
    expect(leads.get("lead:1")?.status).toBe("cancelled");
    expect(leads.get("lead:2")?.status).toBe("cancelled");
    await enqueueSubscriptionCancellation(env, {
      leadId: "1",
      subscriptionId: "sub",
      reason: "Cancelled",
    });
    await runCancellationJobs(env);
    expect(deleted).toHaveLength(2);
  });
});

it("retries a failed lifecycle write after release without losing the captured number SID", async () => {
  let saved = {
    id: "1",
    status: "cancellation_pending",
    shopId: "shop-1",
    assignedNumber: "+13055550123",
    twilioNumberSid: "PN1",
  } as CheckoutLead;
  let failWrite = true;
  let releases = 0;
  const env = {
    OUTREACH_DB: db,
    LEADS_KV: {
      get: async () => structuredClone(saved),
      put: async (_key: string, value: string) => {
        const next = JSON.parse(value) as CheckoutLead;
        if (failWrite && next.status === "cancelled") throw new Error("KV write unavailable");
        saved = next;
      },
    } as unknown as KVNamespace,
    VOICE_AGENT_API_URL: "https://voice.test",
    ADMIN_API_KEY: "key",
    TWILIO_ACCOUNT_SID: "AC",
    TWILIO_AUTH_TOKEN: "token",
  };
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === "DELETE") {
      releases++;
      return new Response(null, { status: releases === 1 ? 204 : 404 });
    }
    return Response.json({ shop: { id: "shop-1", twilio_number: saved.assignedNumber } });
  }) as typeof fetch;
  await enqueueTeardown(db, "shop:shop-1", "resource", {
    leadId: "1",
    shopId: saved.shopId,
    number: saved.assignedNumber,
    numberSid: "PN1",
    reason: "Cancelled",
  });
  await runCancellationJobs(env);
  expect(saved.status).toBe("cancellation_pending");
  expect((await listTeardowns(db))[0]?.last_error).toBe("KV write unavailable");
  failWrite = false;
  await retryTeardown(db, "shop:shop-1");
  await runCancellationJobs(env);
  expect(saved.status).toBe("cancelled");
  expect(await listTeardowns(db)).toHaveLength(0);
  expect(releases).toBe(2);
});

it("blocks missing metadata once, retains it for review, and records manual resolution separately", async () => {
  let notifications = 0;
  globalThis.fetch = (async () => {
    notifications++;
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  const env = { OUTREACH_DB: db, RESEND_API_KEY: "test", LEAD_NOTIFY_EMAIL: "ops@example.com" };
  await enqueueSubscriptionCancellation(env, { subscriptionId: "manual", reason: "Cancelled" });
  expect(notifications).toBe(0);
  await runCancellationJobs(env);
  const [job] = await listTeardowns(db);
  expect(job.status).toBe("blocked");
  expect(job.last_error).toContain("no lead_id");
  await runCancellationJobs(env);
  expect(notifications).toBe(1);
  expect(await claimTeardown(db, Date.now() + 100_000_000)).toBeNull();
  await expect(resolveTeardown(db, job.id, " ")).rejects.toThrow("note");
  await resolveTeardown(db, job.id, "Verified manually: no provisioned resources");
  const row = sqlite.query("SELECT * FROM teardown_jobs WHERE id = ?").get(job.id) as Record<
    string,
    unknown
  >;
  expect(row.status).toBe("resolved");
  expect(row.last_error).toContain("no lead_id");
  expect(row.resolution_note).toContain("Verified manually");
  expect(await listTeardowns(db)).toEqual([]);
  await enqueueSubscriptionCancellation(env, { subscriptionId: "manual", reason: "Replay" });
  expect(await claimTeardown(db)).toBeNull();
});

it("distinguishes a missing lead from an unavailable KV and allows manual retry after repair", async () => {
  let offline = true;
  let lead: CheckoutLead | null = null;
  const env = {
    OUTREACH_DB: db,
    LEADS_KV: {
      get: async () => {
        if (offline) throw new Error("KV unavailable");
        return lead;
      },
      put: async (_key: string, value: string) => {
        lead = JSON.parse(value);
      },
    } as unknown as KVNamespace,
  };
  await enqueueSubscriptionCancellation(env, {
    subscriptionId: "sub",
    leadId: "lead",
    reason: "Cancelled",
  });
  await runCancellationJobs(env);
  expect((await listTeardowns(db))[0].status).toBe("pending");
  offline = false;
  await retryTeardown(db, "subscription:sub");
  await runCancellationJobs(env);
  expect((await listTeardowns(db))[0].status).toBe("blocked");
  lead = { id: "lead", status: "paid", stripeSubscriptionId: "sub" } as CheckoutLead;
  await retryTeardown(db, "subscription:sub");
  await runCancellationJobs(env);
  expect(await listTeardowns(db)).toEqual([]);
  expect(lead.status as string).toBe("cancelled");
});

it("never manually resolves a running task or steals its lease", async () => {
  await enqueueTeardown(db, "shop:running", "resource", {});
  const claimed = await claimTeardown(db);
  if (!claimed) throw new Error("Expected a claimed job");
  await resolveTeardown(db, "shop:running", "Premature resolution");
  await retryTeardown(db, "shop:running");
  const [job] = await listTeardowns(db);
  expect(job.status).toBe("running");
  expect(job.token).toBe(claimed.token);
});

it("preserves existing jobs when extending the status constraint", async () => {
  const old = new Database(":memory:");
  try {
    old.run(await Bun.file("d1/migrations/0007_teardown_jobs.sql").text());
    old.run(
      "INSERT INTO teardown_jobs (id, kind, payload, status, created_at, token, attempts) VALUES ('legacy', 'resource', '{}', 'running', 123, 'lease', 3)",
    );
    old.run(await Bun.file("d1/migrations/0008_teardown_manual_resolution.sql").text());
    expect(old.query("SELECT id, status, token, attempts FROM teardown_jobs").get()).toEqual({
      id: "legacy",
      status: "running",
      token: "lease",
      attempts: 3,
    });
    old.run("UPDATE teardown_jobs SET status = 'blocked'");
  } finally {
    old.close();
  }
});

it("spaces transient failure alerts while retaining automatic retries", async () => {
  let notifications = 0;
  globalThis.fetch = (async () => {
    notifications++;
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  const env = {
    OUTREACH_DB: db,
    RESEND_API_KEY: "test",
    LEAD_NOTIFY_EMAIL: "ops@example.com",
    LEADS_KV: {
      get: async () => {
        throw new Error("KV unavailable");
      },
    } as unknown as KVNamespace,
  };
  await enqueueSubscriptionCancellation(env, {
    subscriptionId: "sub",
    leadId: "lead",
    reason: "Cancelled",
  });
  for (let attempt = 1; attempt <= 4; attempt++) {
    await retryTeardown(db, "subscription:sub");
    await runCancellationJobs(env);
    expect((await listTeardowns(db))[0].status).toBe("pending");
    expect(notifications).toBe(attempt === 3 ? 2 : attempt === 4 ? 3 : attempt);
  }
});

it("blocks changed resource identity without releasing either number", async () => {
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    throw new Error("No network expected");
  }) as unknown as typeof fetch;
  await enqueueTeardown(db, "shop:1", "resource", {
    leadId: "lead",
    shopId: "1",
    numberSid: "PN-old",
  });
  await runCancellationJobs({
    OUTREACH_DB: db,
    LEADS_KV: {
      get: async () => ({ id: "lead", shopId: "1", twilioNumberSid: "PN-new" }),
    } as unknown as KVNamespace,
  });
  const [job] = await listTeardowns(db);
  expect(job.status).toBe("blocked");
  expect(job.last_error).toContain("identity changed");
  expect(requests).toBe(0);
});
