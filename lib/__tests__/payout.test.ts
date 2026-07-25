import { describe, expect, it } from "bun:test";
import { isPayoutMethod, normalisePayoutHandle } from "@/lib/payout";

describe("isPayoutMethod", () => {
  it("accepts the three cash rails", () => {
    expect(isPayoutMethod("paypal")).toBe(true);
    expect(isPayoutMethod("venmo")).toBe(true);
    expect(isPayoutMethod("zelle")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPayoutMethod("bank")).toBe(false);
    expect(isPayoutMethod("credit")).toBe(false);
    expect(isPayoutMethod(undefined)).toBe(false);
  });
});

describe("normalisePayoutHandle", () => {
  it("trims the handle it accepts", () => {
    expect(normalisePayoutHandle("paypal", "  owner@shop.com ")).toBe("owner@shop.com");
  });

  it("takes an email or a paypal.me username for PayPal", () => {
    expect(normalisePayoutHandle("paypal", "owner@shop.com")).toBe("owner@shop.com");
    expect(normalisePayoutHandle("paypal", "@jordan-smith")).toBe("@jordan-smith");
  });

  it("takes a username or a phone for Venmo, but not an email", () => {
    expect(normalisePayoutHandle("venmo", "@jordan-smith")).toBe("@jordan-smith");
    expect(normalisePayoutHandle("venmo", "+1 415 555 0132")).toBe("+1 415 555 0132");
    expect(normalisePayoutHandle("venmo", "owner@shop.com")).toBeNull();
  });

  it("takes an email or a phone for Zelle, but not a username", () => {
    expect(normalisePayoutHandle("zelle", "owner@shop.com")).toBe("owner@shop.com");
    expect(normalisePayoutHandle("zelle", "+14155550132")).toBe("+14155550132");
    expect(normalisePayoutHandle("zelle", "@jordan")).toBeNull();
  });

  it("rejects a blank or non-string handle", () => {
    expect(normalisePayoutHandle("paypal", "   ")).toBeNull();
    expect(normalisePayoutHandle("paypal", null)).toBeNull();
  });
});
