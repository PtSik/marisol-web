import { describe, expect, it } from "bun:test";
import {
  PLAN_OPTIONS,
  PRICE,
  annualSavingPerYear,
  annualTotal,
  canAddLocation,
  isUpgrade,
  maxAnnualSaving,
  normalizePlan,
  upgradesFrom,
} from "@/lib/plans";

describe("annualTotal", () => {
  it("charges ten months for a year", () => {
    expect(annualTotal("basic")).toBe(1490);
    expect(annualTotal("complete")).toBe(2490);
    expect(annualTotal("growth")).toBe(3990);
  });
});

describe("PRICE", () => {
  it("rounds the annual per-month figure down, never up", () => {
    expect(PRICE.basic.annual).toBe(124);
    expect(PRICE.complete.annual).toBe(207);
    expect(PRICE.growth.annual).toBe(332);
    for (const plan of PLAN_OPTIONS) {
      expect(PRICE[plan].annual * 12).toBeLessThanOrEqual(annualTotal(plan));
    }
  });
});

describe("annualSavingPerYear", () => {
  it("is the two months the annual plan doesn't charge", () => {
    expect(annualSavingPerYear("basic")).toBe(298);
    expect(annualSavingPerYear("complete")).toBe(498);
    expect(annualSavingPerYear("growth")).toBe(798);
  });

  it("matches the yearly totals it claims to compare", () => {
    for (const plan of PLAN_OPTIONS) {
      expect(PRICE[plan].monthly * 12 - annualTotal(plan)).toBe(annualSavingPerYear(plan));
    }
  });
});

describe("maxAnnualSaving", () => {
  it("is the largest saving across plans", () => {
    expect(maxAnnualSaving()).toBe(798);
  });
});

describe("isUpgrade", () => {
  it("only counts moves up the ladder", () => {
    expect(isUpgrade("basic", "complete")).toBe(true);
    expect(isUpgrade("basic", "growth")).toBe(true);
    expect(isUpgrade("complete", "growth")).toBe(true);
    expect(isUpgrade("complete", "basic")).toBe(false);
    expect(isUpgrade("growth", "growth")).toBe(false);
  });

  it("lists what each plan can move up to", () => {
    expect(upgradesFrom("basic")).toEqual(["complete", "growth"]);
    expect(upgradesFrom("growth")).toEqual([]);
  });
});

describe("canAddLocation", () => {
  it("starts at Complete", () => {
    expect(canAddLocation("basic")).toBe(false);
    expect(canAddLocation("complete")).toBe(true);
    expect(canAddLocation("growth")).toBe(true);
  });
});

describe("normalizePlan", () => {
  it("maps the plan names leads were stored with before the four tiers", () => {
    expect(normalizePlan("base")).toBe("basic");
    expect(normalizePlan("premium")).toBe("complete");
  });

  it("passes current plans through and falls back to basic", () => {
    for (const plan of PLAN_OPTIONS) expect(normalizePlan(plan)).toBe(plan);
    expect(normalizePlan(undefined)).toBe("basic");
    expect(normalizePlan("enterprise")).toBe("basic");
  });
});
