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

  it("checkpoints the number and suspended shop before activating it", async () => {
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
        events.push("create-shop");
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
        if (body.status === "active") events.push("activate-shop");
        return Response.json({ shop: { id: "shop-1" } });
      }
      return new Response(null, { status: 500 });
    }) as typeof fetch;

    const checkpoints: string[] = [];
    const result = await provisionLead(
      {
        ...env,
        LEADS_KV: { put: async () => {} } as unknown as KVNamespace,
      },
      lead({ accountId: "account-1" }),
      {
        sendWelcome: false,
        checkpoint: async (resource) => {
          const value = resource.shopId ? "checkpoint:shop" : "checkpoint:number";
          checkpoints.push(value);
          events.push(value);
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(checkpoints).toEqual(["checkpoint:number", "checkpoint:shop"]);
    expect(events.indexOf("checkpoint:number")).toBeLessThan(events.indexOf("create-shop"));
    expect(events.indexOf("checkpoint:shop")).toBeLessThan(events.indexOf("activate-shop"));
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
});
