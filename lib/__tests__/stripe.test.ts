import { afterEach, describe, expect, it } from "bun:test";
import {
  type StripeSubscription,
  expireCheckoutSession,
  findPlanItem,
  lookupCheckoutSession,
} from "@/lib/stripe";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const EXTRA = new Set(["price_extra_monthly", "price_extra_annual"]);

const subscription = (priceIds: (string | undefined)[]): StripeSubscription => ({
  id: "sub_1",
  items: { data: priceIds.map((id, i) => ({ id: `si_${i}`, price: id ? { id } : null })) },
});

describe("findPlanItem", () => {
  it("skips the extra-location item whatever order Stripe returns", () => {
    expect(findPlanItem(subscription(["price_base", "price_extra_monthly"]), EXTRA)?.id).toBe(
      "si_0",
    );
    expect(findPlanItem(subscription(["price_extra_monthly", "price_base"]), EXTRA)?.id).toBe(
      "si_1",
    );
  });

  it("finds the plan on a subscription that has no extra locations", () => {
    expect(findPlanItem(subscription(["price_base"]), EXTRA)?.id).toBe("si_0");
  });

  it("treats an item without a price as the plan rather than dropping it", () => {
    expect(findPlanItem(subscription([undefined]), EXTRA)?.id).toBe("si_0");
  });

  it("returns undefined when there is nothing but extra locations, or no subscription", () => {
    expect(findPlanItem(subscription(["price_extra_annual"]), EXTRA)).toBeUndefined();
    expect(findPlanItem(null, EXTRA)).toBeUndefined();
  });
});

describe("Checkout session lookup", () => {
  it("distinguishes a permanent 404 from a retryable Stripe failure", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
    await expect(lookupCheckoutSession("sk_test", "cs_missing")).resolves.toEqual({
      kind: "missing",
    });

    globalThis.fetch = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    await expect(lookupCheckoutSession("sk_test", "cs_retry")).resolves.toEqual({
      kind: "unavailable",
      status: 503,
    });

    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(lookupCheckoutSession("sk_test", "cs_network")).resolves.toEqual({
      kind: "unavailable",
    });
  });

  it("returns the open session and expires it through Stripe's dedicated endpoint", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), method: init?.method });
      if (init?.method === "POST") return Response.json({ id: "cs_open", status: "expired" });
      return Response.json({ id: "cs_open", status: "open", url: "https://checkout.test" });
    }) as typeof fetch;

    await expect(lookupCheckoutSession("sk_test", "cs_open")).resolves.toEqual({
      kind: "found",
      session: { id: "cs_open", status: "open", url: "https://checkout.test" },
    });
    await expect(expireCheckoutSession("sk_test", "cs_open")).resolves.toBe(true);
    expect(calls[1]).toEqual({
      url: "https://api.stripe.com/v1/checkout/sessions/cs_open/expire",
      method: "POST",
    });
  });
});
