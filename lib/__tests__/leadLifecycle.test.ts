import { describe, expect, it } from "bun:test";
import {
  ACTIVATABLE_LEAD_STATUSES,
  type CheckoutLead,
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
    expect(checkoutCompletionCanAdvance("paid")).toBe(false);
    expect(checkoutCompletionCanAdvance("pending_review")).toBe(false);
    expect(checkoutCompletionCanAdvance("activating")).toBe(false);
    expect(checkoutCompletionCanAdvance("provisioned")).toBe(false);
    expect(checkoutCompletionCanAdvance("cancellation_pending")).toBe(false);
    expect(checkoutCompletionCanAdvance("cancelled")).toBe(false);
  });

  it("only exposes the admin activation action for explicit launch-gate states", () => {
    expect(ACTIVATABLE_LEAD_STATUSES.has("pending_review")).toBe(true);
    expect(ACTIVATABLE_LEAD_STATUSES.has("activation_failed")).toBe(true);
    expect(ACTIVATABLE_LEAD_STATUSES.has("setup_complete")).toBe(true);
    expect(ACTIVATABLE_LEAD_STATUSES.has("cancelled")).toBe(false);
  });

  it("renders every pre-activation state as waiting", () => {
    expect(isWaitingForActivation("setup_complete")).toBe(true);
    expect(isWaitingForActivation("pending_review")).toBe(true);
    expect(isWaitingForActivation("activating")).toBe(true);
    expect(isWaitingForActivation("activation_failed")).toBe(true);
    expect(isWaitingForActivation("provisioned")).toBe(false);
  });

  it("locks the dashboard through review and reconciliation", () => {
    for (const status of [
      "paid",
      "setup_complete",
      "pending_review",
      "activating",
      "activation_failed",
      "cancellation_pending",
    ] as const) {
      expect(isDashboardLocked(status)).toBe(true);
    }
    expect(isDashboardLocked("created")).toBe(false);
    expect(isDashboardLocked("provisioned")).toBe(false);
    expect(isDashboardLocked("cancelled")).toBe(false);
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
