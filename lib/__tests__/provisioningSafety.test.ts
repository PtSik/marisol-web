import { afterEach, describe, expect, it } from "bun:test";
import type { CheckoutLead } from "@/lib/leads";
import { defaultSetup } from "@/lib/onboarding";
import { deprovisionLead, deprovisionShop, provisionLead } from "@/lib/provisioning";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function lead(overrides: Partial<CheckoutLead> = {}): CheckoutLead {
  const setup = defaultSetup("grooming", ["Full groom"]);
  setup.forwardNumber = "+1 (305) 555-0100";
  setup.staff[0].name = "Ana";
  setup.services = defaultSetup("grooming", ["Full groom"]).services.slice(0, 1);
  return {
    id: "lead-1",
    createdAt: "2026-09-03T12:00:00Z",
    intent: "checkout",
    billing: "monthly",
    basics: {
      vertical: "grooming",
      businessName: "Ana's Grooming",
      ownerName: "Ana",
      email: "ana@example.com",
      businessPhone: "+13055550100",
      ownerMobile: "+1 (305) 555-0111",
      timezone: "America/New_York",
    },
    status: "pending_review",
    setup,
    ...overrides,
  };
}

const env = {
  VOICE_AGENT_API_URL: "https://voice.test",
  ADMIN_API_KEY: "admin-key",
  TWILIO_ACCOUNT_SID: "AC-test",
  TWILIO_AUTH_TOKEN: "secret",
  GROOMING_AGENT_ID: "agent-grooming",
};

describe("provisionLead launch validation", () => {
  it("rejects an invalid owner phone before any external side effect", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;
    const invalid = lead();
    invalid.basics.ownerMobile = "555-0111";

    await expect(provisionLead(env, invalid)).resolves.toEqual({
      ok: false,
      reason: "invalid owner mobile",
      cleanupComplete: true,
    });
    expect(fetches).toBe(0);
  });

  it("rejects an invalid admin area-code override before any external side effect", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;

    await expect(provisionLead(env, lead(), { areaCodeOverride: "012" })).resolves.toEqual({
      ok: false,
      reason: "invalid area code override",
      cleanupComplete: true,
    });
    expect(fetches).toBe(0);
  });

  it("searches an approved neighbouring area code without changing the forwarding number", async () => {
    const urls: string[] = [];
    const candidate = lead();
    globalThis.fetch = (async (input) => {
      urls.push(String(input));
      return Response.json({ available_phone_numbers: [] });
    }) as typeof fetch;

    await expect(provisionLead(env, candidate, { areaCodeOverride: "786" })).resolves.toMatchObject(
      {
        ok: false,
        reason: "no US local number available (tried area code 786)",
        cleanupComplete: true,
      },
    );
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("AreaCode=786");
    expect(candidate.setup?.forwardNumber).toBe("+13055550100");
  });

  it("returns the Twilio identity when automatic cleanup fails", async () => {
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.includes("AvailablePhoneNumbers")) {
        return Response.json({ available_phone_numbers: [{ phone_number: "+13055550123" }] });
      }
      if (url.endsWith("/IncomingPhoneNumbers.json") && init?.method === "POST") {
        return Response.json({ phone_number: "+13055550123", sid: "PN123" });
      }
      if (url.includes("/IncomingPhoneNumbers/PN123.json")) {
        return new Response(null, { status: 500 });
      }
      if (url === "https://voice.test/admin/shops") {
        return new Response(null, { status: 500 });
      }
      return new Response(null, { status: 500 });
    }) as typeof fetch;

    await expect(provisionLead(env, lead())).resolves.toEqual({
      ok: false,
      reason: "admin POST /shops failed",
      cleanupComplete: false,
      number: "+13055550123",
      numberSid: "PN123",
    });
  });

  it("blocks retry and retains the candidate after an ambiguous Twilio purchase", async () => {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("AvailablePhoneNumbers")) {
        return Response.json({ available_phone_numbers: [{ phone_number: "+13055550123" }] });
      }
      if (url.includes("IncomingPhoneNumbers.json?")) {
        return Response.json({ incoming_phone_numbers: [] });
      }
      throw new Error("response lost");
    }) as typeof fetch;

    await expect(provisionLead(env, lead())).resolves.toMatchObject({
      ok: false,
      cleanupComplete: false,
      number: "+13055550123",
      reason: expect.stringContaining("needs reconciliation"),
    });
  });

  it("checkpoints the number and the suspended shop, and never makes either live", async () => {
    const events: string[] = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.includes("AvailablePhoneNumbers")) {
        return Response.json({ available_phone_numbers: [{ phone_number: "+13055550123" }] });
      }
      if (url.endsWith("/IncomingPhoneNumbers.json") && init?.method === "POST") {
        events.push("purchase");
        return Response.json({ phone_number: "+13055550123", sid: "PN123" });
      }
      if (url === "https://voice.test/admin/shops" && init?.method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          status?: string;
          service_catalog?: unknown;
        };
        events.push(`create-shop:${body.status}`);
        // The catalog is the shop's only record of what it sells, so the price the owner
        // reviewed has to be on it — voice-agent reads the spoken list from here.
        expect(body.service_catalog).toEqual([
          { name: "Full groom", duration_minutes: 75, price: 40, price_max: 55 },
        ]);
        return Response.json({ shop: { id: "shop-1" } });
      }
      if (url === "https://voice.test/admin/accounts/account-1") {
        return Response.json({
          account: {
            id: "account-1",
            email: "ana@example.com",
            shop_id: "shop-1",
            referral_code: "ANA123",
          },
        });
      }
      if (url === "https://voice.test/admin/shops/shop-1") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { status?: string };
        if (body.status) events.push(`patch-status:${body.status}`);
        return Response.json({ shop: { id: "shop-1" } });
      }
      return new Response(null, { status: 500 });
    }) as typeof fetch;

    const result = await provisionLead(
      { ...env, LEADS_KV: { put: async () => {} } as unknown as KVNamespace },
      lead({ accountId: "account-1" }),
      {
        checkpoint: async (resource) => {
          events.push(resource.shopId ? "checkpoint:shop" : "checkpoint:number");
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      shopId: "shop-1",
      number: "+13055550123",
      numberSid: "PN123",
    });
    // Each resource is durably recorded before the next one is created, and the operator — not
    // provisioning — is what turns the shop on, so no status PATCH appears at all.
    expect(events).toEqual([
      "purchase",
      "checkpoint:number",
      "create-shop:suspended",
      "checkpoint:shop",
    ]);
  });
});

describe("deprovisionLead", () => {
  it("never releases a number when suspending the shop fails", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith("https://voice.test/admin/shops/")) {
        return new Response(null, { status: 503 });
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    const primary = await deprovisionLead(env, {
      ...lead(),
      shopId: "shop-1",
      assignedNumber: "+13055550123",
      twilioNumberSid: "PN123",
    });
    const orphan = await deprovisionShop(env, "shop-2", "+13055550124");

    expect(primary).toEqual({
      suspendedShop: false,
      releasedNumber: false,
      cancelledShop: false,
      complete: false,
    });
    expect(orphan).toEqual(primary);
    expect(calls.filter((url) => url.includes("IncomingPhoneNumbers"))).toHaveLength(0);
  });

  it("uses the stored SID, suspends first and only cancels after Twilio confirms release", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      calls.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
      if (url.includes("IncomingPhoneNumbers/PN123")) return new Response(null, { status: 204 });
      return Response.json({ shop: { id: "shop-1" } });
    }) as typeof fetch;

    const result = await deprovisionLead(env, {
      ...lead(),
      shopId: "shop-1",
      assignedNumber: "+13055550123",
      twilioNumberSid: "PN123",
    });

    expect(result.complete).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[0].body).toContain('"status":"suspended"');
    expect(calls[1].url).toContain("IncomingPhoneNumbers/PN123");
    expect(calls[2].body).toContain('"status":"cancelled"');
    expect(calls.some((call) => call.url.includes("IncomingPhoneNumbers.json?"))).toBe(false);
  });

  it("leaves the shop suspended and reports incomplete cleanup after Twilio failure", async () => {
    const patches: string[] = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.includes("IncomingPhoneNumbers/PN123")) return new Response(null, { status: 500 });
      if (typeof init?.body === "string") patches.push(init.body);
      return Response.json({ shop: { id: "shop-1" } });
    }) as typeof fetch;

    const result = await deprovisionLead(env, {
      ...lead(),
      shopId: "shop-1",
      assignedNumber: "+13055550123",
      twilioNumberSid: "PN123",
    });

    expect(result.complete).toBe(false);
    expect(result.releasedNumber).toBe(false);
    expect(patches).toEqual(['{"status":"suspended"}']);
  });

  it("reports a complete teardown for a lead that never got a shop row", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      urls.push(String(input));
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    const result = await deprovisionLead(env, {
      ...lead(),
      assignedNumber: "+13055550123",
      twilioNumberSid: "PN123",
    });

    expect(result).toEqual({
      suspendedShop: true,
      releasedNumber: true,
      cancelledShop: true,
      complete: true,
    });
    expect(urls.some((url) => url.startsWith("https://voice.test/"))).toBe(false);
  });

  it("cancels a shop that has no number without calling Twilio", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      urls.push(String(input));
      return Response.json({ shop: { id: "shop-1" } });
    }) as typeof fetch;

    const result = await deprovisionLead(env, { ...lead(), shopId: "shop-1" });

    expect(result.complete).toBe(true);
    expect(urls.some((url) => url.includes("twilio.com"))).toBe(false);
  });

  it("refuses a salon whose shop id was lost rather than reporting a clean teardown", async () => {
    let called = false;
    globalThis.fetch = (async (_input: unknown) => {
      called = true;
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    const result = await deprovisionShop(env, "", "+13055550124");

    expect(result).toEqual({
      suspendedShop: false,
      releasedNumber: false,
      cancelledShop: false,
      complete: false,
    });
    // An empty id must never reach Twilio: releasing the number is the irreversible half.
    expect(called).toBe(false);
  });

  it("looks a salon's SID up by number when only the shop row is known", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("IncomingPhoneNumbers.json?"))
        return Response.json({ incoming_phone_numbers: [{ sid: "PN999" }] });
      return Response.json({ shop: { id: "shop-2" } });
    }) as typeof fetch;

    const result = await deprovisionShop(env, "shop-2", "+13055550124");

    expect(result.complete).toBe(true);
    expect(urls.some((url) => url.includes("IncomingPhoneNumbers.json?"))).toBe(true);
    expect(urls.some((url) => url.includes("/IncomingPhoneNumbers/PN999.json"))).toBe(true);
  });
});

it("releases a stored SID even when the phone string was lost", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url) => {
    urls.push(String(url));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  expect((await deprovisionLead(env, lead({ twilioNumberSid: "PN123" }))).complete).toBe(true);
  expect(urls).toHaveLength(1);
  expect(urls[0]).toContain("/IncomingPhoneNumbers/PN123.json");
});

it("rolls back a checkpoint failure sequentially and retains resources if release fails", async () => {
  const events: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.includes("AvailablePhoneNumbers"))
      return Response.json({ available_phone_numbers: [{ phone_number: "+13055550123" }] });
    if (init?.method === "DELETE") {
      events.push("release");
      return new Response(null, { status: 503 });
    }
    if (url.endsWith("IncomingPhoneNumbers.json"))
      return Response.json({ phone_number: "+13055550123", sid: "PN123" });
    if (url.endsWith("/admin/shops")) return Response.json({ shop: { id: "shop-1" } });
    events.push(JSON.parse(String(init?.body)).status);
    return Response.json({ shop: { id: "shop-1" } });
  }) as typeof fetch;
  const result = await provisionLead(env, lead(), {
    checkpoint: async (resource) => {
      if (resource.shopId) throw new Error("checkpoint failed");
    },
  });
  expect(events).toEqual(["suspended", "release"]);
  expect(result).toMatchObject({
    ok: false,
    cleanupComplete: false,
    shopId: "shop-1",
    numberSid: "PN123",
  });
});
