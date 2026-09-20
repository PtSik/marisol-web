import { describe, expect, it } from "bun:test";
import {
  ACTIVATABLE_LEAD_STATUSES,
  type CheckoutLead,
  type LeadStatus,
  activationNeedsReconciliation,
  checkoutCompletionCanAdvance,
  checkoutRequestMatchesLead,
  getLeadStrict,
  isCancellationState,
  isDashboardLocked,
  isWaitingForActivation,
} from "@/lib/leads";

function lead(overrides: Partial<CheckoutLead> = {}): CheckoutLead {
  return {
    id: "lead-1",
    createdAt: "2026-09-03T12:00:00Z",
    intent: "checkout",
    plan: "complete",
    billing: "annual",
    locale: "en",
    basics: {
      vertical: "grooming",
      businessName: "Ana's Grooming",
      ownerName: "Ana",
      email: "ana@example.com",
      businessPhone: "+13055550100",
      address: "1 Main St",
      ownerMobile: "+13055550111",
      timezone: "America/New_York",
    },
    status: "created",
    checkoutReuseVersion: 1,
    checkoutPromotionId: "promo-1",
    checkoutReferralCode: "ANA10",
    ...overrides,
  };
}

describe("assisted-launch lead lifecycle", () => {
  it("only lets checkout completion advance a newly-created lead", () => {
    expect(checkoutCompletionCanAdvance("created")).toBe(true);
    expect(checkoutCompletionCanAdvance("pending_review")).toBe(false);
    expect(checkoutCompletionCanAdvance("activating")).toBe(false);
    expect(checkoutCompletionCanAdvance("provisioned")).toBe(false);
    expect(checkoutCompletionCanAdvance("cancellation_pending")).toBe(false);
    expect(checkoutCompletionCanAdvance("cancelled")).toBe(false);
  });

  // Exhaustive over LeadStatus on purpose: adding a status has to be a decision about all three
  // gates, not something that silently defaults to "not waiting, not locked, not activatable".
  it("classifies every lead status against the activation gates", () => {
    const expected: Record<
      LeadStatus,
      { activatable: boolean; waiting: boolean; locked: boolean }
    > = {
      created: { activatable: false, waiting: false, locked: false },
      pending_review: { activatable: true, waiting: true, locked: true },
      activating: { activatable: false, waiting: true, locked: true },
      activation_failed: { activatable: true, waiting: true, locked: true },
      provisioned: { activatable: false, waiting: false, locked: false },
      cancellation_pending: { activatable: false, waiting: false, locked: true },
      cancelled: { activatable: false, waiting: false, locked: true },
    };
    for (const [status, want] of Object.entries(expected) as Array<
      [LeadStatus, (typeof expected)[LeadStatus]]
    >) {
      expect({
        activatable: ACTIVATABLE_LEAD_STATUSES.has(status),
        waiting: isWaitingForActivation(status),
        locked: isDashboardLocked(status),
      }).toEqual(want);
    }
  });

  it("recognises cancellation pages without treating them as setup", () => {
    expect(isCancellationState("cancellation_pending")).toBe(true);
    expect(isCancellationState("cancelled")).toBe(true);
    expect(isCancellationState("pending_review")).toBe(false);
  });

  it("requires reconciliation whenever an activation left an external identity or lock", () => {
    expect(activationNeedsReconciliation(lead({ status: "activation_failed" }))).toBe(false);
    for (const marker of [
      { activationStartedAt: "2026-09-03T12:01:00Z" },
      { activationLockToken: "lock-1" },
      { shopId: "shop-1" },
      { assignedNumber: "+13055550123" },
      { twilioNumberSid: "PN123" },
    ]) {
      expect(activationNeedsReconciliation(lead({ status: "activation_failed", ...marker }))).toBe(
        true,
      );
    }
  });

  it("reuses Checkout only when every material selection still matches", () => {
    const existing = lead();
    const request = {
      plan: "complete" as const,
      billing: "annual" as const,
      locale: "en" as const,
      basics: { ...existing.basics },
      promotionId: "promo-1",
      referralCode: "ANA10",
    };
    expect(checkoutRequestMatchesLead(existing, request)).toBe(true);
    expect(
      checkoutRequestMatchesLead({ ...existing, checkoutReuseVersion: undefined }, request),
    ).toBe(false);
    expect(checkoutRequestMatchesLead(existing, { ...request, plan: "basic" })).toBe(false);
    expect(checkoutRequestMatchesLead(existing, { ...request, billing: "monthly" })).toBe(false);
    expect(checkoutRequestMatchesLead(existing, { ...request, promotionId: "promo-2" })).toBe(
      false,
    );
    expect(
      checkoutRequestMatchesLead(existing, {
        ...request,
        basics: { ...request.basics, businessName: "A different shop" },
      }),
    ).toBe(false);
  });

  it("lets financial callers distinguish a missing lead from a KV outage", async () => {
    const missing = { get: async () => null } as unknown as KVNamespace;
    await expect(getLeadStrict(missing, "lead-1")).resolves.toBeNull();

    const unavailable = {
      get: async () => {
        throw new Error("KV unavailable");
      },
    } as unknown as KVNamespace;
    await expect(getLeadStrict(unavailable, "lead-1")).rejects.toThrow("KV unavailable");
  });
});
