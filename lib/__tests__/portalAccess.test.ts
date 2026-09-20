import { describe, expect, it } from "bun:test";
import { portalAccessRedirect } from "@/lib/portalAccess";
import type { PortalSession } from "@/lib/session";

const session: PortalSession = {
  accountId: "a",
  leadId: "lead",
  email: "a@example.com",
  createdAt: "2026-01-01",
};
function env(status: string, stripeSessionId?: string) {
  return { LEADS_KV: { get: async () => ({ status, stripeSessionId }) } as unknown as KVNamespace };
}
// The account-first branch: a login that has a salon but no lead behind it, so the shop row is the
// only lifecycle there is. Its status list has to agree with voice-agent's CALLABLE_STATUSES, or
// the portal opens for an owner whose number is not answering.
function shopEnv(status: string) {
  return {
    LEADS_KV: { get: async () => null } as unknown as KVNamespace,
    VOICE_AGENT_API_URL: "https://voice.test",
    ADMIN_API_KEY: "admin-key",
    VOICE_AGENT_API: {
      fetch: async () => Response.json({ shop: { id: "shop-1", status } }),
    } as unknown as Fetcher,
  };
}

describe("portal access without a lead", () => {
  it("opens only for the statuses that answer the phone", async () => {
    const withShop = { ...session, leadId: undefined, shopId: "shop-1" };
    for (const status of ["active", "demo"]) {
      expect(await portalAccessRedirect(shopEnv(status), withShop)).toBeNull();
    }
    for (const status of ["suspended", "cancelled", "trial"]) {
      expect(await portalAccessRedirect(shopEnv(status), withShop)).toBe("/account-status");
    }
  });
});

describe("portal lifecycle access", () => {
  it("sends an account with no lead or shop to setup after login", async () => {
    const newAccount = { ...session, leadId: undefined, shopId: undefined };
    const empty = { LEADS_KV: { get: async () => null } as unknown as KVNamespace };
    expect(await portalAccessRedirect(empty, newAccount)).toBe("/onboarding");
    expect(await portalAccessRedirect(env("created"), session)).toBe("/onboarding");
  });
  it("rechecks a live session after cancellation, preserving the billing recovery page", async () => {
    expect(await portalAccessRedirect(env("provisioned"), session)).toBeNull();
    expect(await portalAccessRedirect(env("cancelled", "cs_1"), session)).toBe(
      "/onboarding/thanks?session_id=cs_1",
    );
    expect(await portalAccessRedirect(env("cancelled"), session)).toBe("/account-status");
  });
  it("blocks review and cleanup even without a checkout URL", async () => {
    for (const status of ["pending_review", "cancellation_pending", "activation_failed"]) {
      expect(await portalAccessRedirect(env(status), session)).toBe("/account-status");
    }
  });
  it("opens the limited portal during review without opening cancelled accounts", async () => {
    expect(
      await portalAccessRedirect(env("pending_review"), session, { allowPending: true }),
    ).toBeNull();
    expect(
      await portalAccessRedirect(env("activation_failed"), session, { allowPending: true }),
    ).toBeNull();
    expect(await portalAccessRedirect(env("cancelled"), session, { allowPending: true })).toBe(
      "/account-status",
    );
  });
  it("does not turn missing data or a KV outage into access", async () => {
    expect(
      await portalAccessRedirect(
        { LEADS_KV: { get: async () => null } as unknown as KVNamespace },
        session,
      ),
    ).toBe("/account-status");
    await expect(
      portalAccessRedirect(
        {
          LEADS_KV: {
            get: async () => {
              throw new Error("offline");
            },
          } as unknown as KVNamespace,
        },
        session,
      ),
    ).rejects.toThrow("offline");
  });
});
