import { describe, expect, it } from "bun:test";
import { PRICE, annualSavingPerYear, maxAnnualSaving, premiumSaving } from "@/lib/plans";

describe("annualSavingPerYear", () => {
  it("is twelve times the monthly difference", () => {
    expect(annualSavingPerYear("base")).toBe(204);
    expect(annualSavingPerYear("premium")).toBe(360);
  });

  it("matches the yearly totals it claims to compare", () => {
    for (const plan of ["base", "premium"] as const) {
      expect(PRICE[plan].monthly * 12 - PRICE[plan].annual * 12).toBe(annualSavingPerYear(plan));
    }
  });
});

describe("maxAnnualSaving", () => {
  it("is the largest saving across plans", () => {
    expect(maxAnnualSaving()).toBe(360);
  });
});

describe("premiumSaving", () => {
  it("compares Premium against two Base plans, not against monthly billing", () => {
    expect(premiumSaving("monthly")).toBe(49);
    expect(premiumSaving("annual")).toBe(45);
  });
});
