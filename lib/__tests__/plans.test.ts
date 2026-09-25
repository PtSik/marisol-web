import { describe, expect, it } from "bun:test";
import {
  EXTRA_LOCATION_ANNUAL_TOTAL,
  EXTRA_LOCATION_PRICE,
  PLAN_OPTIONS,
  PRICE,
  annualSavingPerYear,
  annualTotal,
  billableSalons,
  canAddLocation,
  extraLocationCount,
  isUpgrade,
  maxAnnualSaving,
  normalizePlan,
  upgradesFrom,
} from "@/lib/plans";

describe("annualTotal", () => {
  it("charges ten months for a year", () => {
    expect(annualTotal("basic")).toBe(1990);
    expect(annualTotal("complete")).toBe(2490);
    expect(annualTotal("growth")).toBe(3990);
  });
});

describe("PRICE", () => {
  it("rounds the annual per-month figure down, never up", () => {
    expect(PRICE.basic.annual).toBe(165);
    expect(PRICE.complete.annual).toBe(207);
    expect(PRICE.growth.annual).toBe(332);
    for (const plan of PLAN_OPTIONS) {
      expect(PRICE[plan].annual * 12).toBeLessThanOrEqual(annualTotal(plan));
    }
  });
});

describe("annualSavingPerYear", () => {
  it("is the two months the annual plan doesn't charge", () => {
    expect(annualSavingPerYear("basic")).toBe(398);
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

describe("EXTRA_LOCATION_PRICE", () => {
  it("follows the same two-months-free rule as the plans", () => {
    expect(EXTRA_LOCATION_PRICE.monthly).toBe(149);
    expect(EXTRA_LOCATION_ANNUAL_TOTAL).toBe(1490);
    expect(EXTRA_LOCATION_PRICE.annual).toBe(124);
    expect(EXTRA_LOCATION_PRICE.annual * 12).toBeLessThanOrEqual(EXTRA_LOCATION_ANNUAL_TOTAL);
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

describe("billableSalons", () => {
  // The case that overcharged: one live salon, one just launched, one merely prepared. Preparation
  // leaves a shop suspended, so counting everything not cancelled billed two extra locations.
  it("counts salons that answer, not salons that exist", () => {
    const shops = [{ status: "active" }, { status: "active" }, { status: "suspended" }];
    expect(billableSalons(shops)).toBe(2);
    expect(extraLocationCount("complete", billableSalons(shops))).toBe(1);
  });

  it("ignores cancelled and unknown statuses", () => {
    expect(billableSalons([{ status: "cancelled" }, { status: undefined }, {}])).toBe(0);
  });
});
