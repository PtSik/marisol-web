import { afterEach, describe, expect, it } from "bun:test";
import {
  type StripeSubscription,
  canLaunchLocation,
  expireCheckoutSession,
  findPlanItem,
  lookupCheckoutSession,
  resumeSubscription,
  scheduleSubscriptionCancellation,
  swapSubscriptionPrice,
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

describe("subscription cancellation", () => {
  it("schedules the end once through Stripe with a stable idempotency key", async () => {
    let request: RequestInit | undefined;
    globalThis.fetch = (async (_input, init) => {
      request = init;
      return Response.json({ id: "sub_1", cancel_at_period_end: true });
    }) as typeof fetch;

    await expect(scheduleSubscriptionCancellation("sk_test", "sub_1")).resolves.toMatchObject({
      cancel_at_period_end: true,
    });
    expect(request?.method).toBe("POST");
    expect((request?.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "cancel-at-period-end:sub_1",
    );
    expect(String(request?.body)).toBe("cancel_at_period_end=true");
  });

  it("resumes a scheduled cancellation through Stripe", async () => {
    let request: RequestInit | undefined;
    globalThis.fetch = (async (_input, init) => {
      request = init;
      return Response.json({ id: "sub_1", cancel_at_period_end: false });
    }) as typeof fetch;

    await expect(resumeSubscription("sk_test", "sub_1")).resolves.toMatchObject({
      cancel_at_period_end: false,
    });
    expect((request?.headers as Record<string, string>)["Idempotency-Key"]).toBe("resume:sub_1");
    expect(String(request?.body)).toBe("cancel_at_period_end=false");
  });
});

describe("plan changes", () => {
  it("replaces the plan item without clearing the subscription's existing discount", async () => {
    let request: RequestInit | undefined;
    globalThis.fetch = (async (_input, init) => {
      request = init;
      return Response.json({ id: "sub_1", status: "trialing" });
    }) as typeof fetch;

    await swapSubscriptionPrice("sk_test", {
      subscriptionId: "sub_1",
      itemId: "si_plan",
      priceId: "price_growth",
      plan: "growth",
    });
    const body = new URLSearchParams(String(request?.body));
    expect(body.get("items[0][id]")).toBe("si_plan");
    expect(body.get("items[0][price]")).toBe("price_growth");
    expect(body.has("discounts")).toBe(false);
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

describe("canLaunchLocation", () => {
  const sub = (over: Partial<StripeSubscription> = {}): StripeSubscription => ({
    id: "sub_1",
    status: "active",
    ...over,
  });

  it("allows a subscription that is paying and staying", () => {
    expect(canLaunchLocation(sub())).toBe(true);
    expect(canLaunchLocation(sub({ status: "trialing" }))).toBe(true);
  });

  // The divergence from UPGRADABLE_STATUSES: a plan swap costs nothing up front, a new location
  // buys a number. Both callers have to refuse these, or the portal takes a request activation
  // will not honour.
  it("refuses a subscription that is behind or on its way out", () => {
    expect(canLaunchLocation(sub({ status: "past_due" }))).toBe(false);
    expect(canLaunchLocation(sub({ cancel_at_period_end: true }))).toBe(false);
    expect(canLaunchLocation(sub({ status: "canceled" }))).toBe(false);
    expect(canLaunchLocation(sub({ status: undefined }))).toBe(false);
    expect(canLaunchLocation(null)).toBe(false);
  });
});
