import { describe, expect, it } from "bun:test";
import { type StripeSubscription, findPlanItem } from "@/lib/stripe";

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
