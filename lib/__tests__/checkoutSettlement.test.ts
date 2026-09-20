import { describe, expect, it } from "bun:test";
import { settledLead } from "@/lib/checkoutSettlement";
import { type CheckoutLead, checkoutRequestMatchesLead } from "@/lib/leads";
import { defaultBasics, defaultSetup } from "@/lib/onboarding";
import type { StripeCheckoutSession } from "@/lib/stripe";
const setup = {
  ...defaultSetup("barbershop", ["Haircut", "Beard", "Both"]),
  forwardNumber: "+13055550100",
  staff: [{ id: "ana", name: "Ana", hours: null }],
};
const lead: CheckoutLead = {
  id: "l1",
  accountId: "a1",
  stripeSessionId: "cs_1",
  createdAt: "now",
  intent: "checkout",
  billing: "monthly",
  basics: defaultBasics(),
  status: "created",
  setup,
};
const session: StripeCheckoutSession = {
  id: "cs_1",
  status: "complete",
  payment_status: "no_payment_required",
  subscription: "sub_1",
  customer: "cus_1",
  metadata: { lead_id: "l1", account_id: "a1" },
};
describe("reviewed checkout settlement", () => {
  it("queues the frozen setup for review without a browser setup submission", () => {
    const result = settledLead(lead, session);
    expect(result.status).toBe("pending_review");
    expect(result.setup).toEqual(setup);
    expect(result.stripeSubscriptionId).toBe("sub_1");
    expect(result.setupCompletedAt).toBeTruthy();
    expect(lead.status).toBe("created");
    expect(settledLead(result, session)).toBe(result);
  });
  it("refuses to settle a checkout with no reviewed setup behind it", () => {
    expect(() => settledLead({ ...lead, setup: undefined }, session)).toThrow(
      "Reviewed setup is invalid",
    );
  });
  it("does not resurrect cancellation or activation", () => {
    for (const status of [
      "cancelled",
      "cancellation_pending",
      "activating",
      "activation_failed",
      "provisioned",
    ] as const)
      expect(settledLead({ ...lead, status }, session).status).toBe(status);
  });
  it("rejects unpaid, unrelated and superseded sessions", () => {
    expect(() => settledLead(lead, { ...session, status: "open" })).toThrow();
    expect(() => settledLead(lead, { ...session, id: "other" })).toThrow();
    expect(() =>
      settledLead(lead, { ...session, metadata: { lead_id: "l1", account_id: "other" } }),
    ).toThrow();
    expect(() => settledLead({ ...lead, setup: undefined }, session)).toThrow();
    expect(() =>
      settledLead(
        { ...lead, checkoutAttempt: 2, stripeSessionId: undefined },
        { ...session, metadata: { ...session.metadata, checkout_attempt: "1" } },
      ),
    ).toThrow("Checkout attempt mismatch");
  });
  it("does not reuse a payable checkout after setup changes", () => {
    const base = {
      ...lead,
      plan: "basic" as const,
      locale: "en" as const,
      checkoutReuseVersion: 1 as const,
    };
    const request = {
      plan: "basic" as const,
      billing: "monthly" as const,
      locale: "en" as const,
      basics: lead.basics,
      setup,
    };
    expect(checkoutRequestMatchesLead(base, request)).toBe(true);
    expect(
      checkoutRequestMatchesLead(base, { ...request, setup: { ...setup, notes: "Changed" } }),
    ).toBe(false);
  });
});
