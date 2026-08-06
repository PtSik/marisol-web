import { describe, expect, it } from "bun:test";
import type { CheckoutLead } from "@/lib/leads";
import { defaultSetup, isBusinessBasics } from "@/lib/onboarding";
import { buildShopPayload } from "@/lib/provisioning";

const AGENTS = { grooming: "agent_grooming", barber: "agent_barber" };

function lead(
  overrides: {
    address?: string;
    notes?: string;
  } = {},
): CheckoutLead {
  const setup = defaultSetup("barbershop", ["Haircut"]);
  return {
    id: "lead-1",
    createdAt: "2026-08-01T12:00:00Z",
    intent: "checkout",
    billing: "monthly",
    basics: {
      vertical: "barbershop",
      businessName: "Barbarossa Barbershop",
      ownerName: "Ana",
      email: "ana@example.com",
      businessPhone: "+13055550100",
      ownerMobile: "+13055550111",
      timezone: "America/New_York",
      ...(overrides.address === undefined ? {} : { address: overrides.address }),
    },
    status: "paid",
    setup: { ...setup, notes: overrides.notes ?? "" },
  } as CheckoutLead;
}

describe("buildShopPayload — address", () => {
  it("carries the address the owner typed", () => {
    const p = buildShopPayload(lead({ address: "1420 Bedford Ave, Brooklyn NY" }), "+1833", AGENTS);
    expect(p.address).toBe("1420 Bedford Ave, Brooklyn NY");
  });

  it("sends null when the owner left it blank", () => {
    expect(buildShopPayload(lead({ address: "   " }), "+1833", AGENTS).address).toBeNull();
  });

  // Leads created before the field existed have no `address` key at all.
  it("sends null when the lead predates the field", () => {
    expect(buildShopPayload(lead(), "+1833", AGENTS).address).toBeNull();
  });
});

describe("buildShopPayload — notes", () => {
  // The wizard has collected this since day one ("Parking info, walk-in policy…") and it reached
  // the team notification email only — never the shop row, so the agent escalated on questions the
  // owner had already answered. This test is the regression guard for that silent drop.
  it("carries the owner's notes through to the shop", () => {
    const p = buildShopPayload(
      lead({ notes: "Walk-ins welcome. Free lot out back." }),
      "+1833",
      AGENTS,
    );
    expect(p.notes).toBe("Walk-ins welcome. Free lot out back.");
  });

  it("sends null for empty notes rather than an empty string", () => {
    expect(buildShopPayload(lead({ notes: "  " }), "+1833", AGENTS).notes).toBeNull();
  });
});

describe("isBusinessBasics — address", () => {
  const basics = (address?: unknown) => ({
    vertical: "barbershop",
    businessName: "B",
    ownerName: "A",
    email: "a@b.com",
    businessPhone: "+1",
    ownerMobile: "+1",
    timezone: "America/New_York",
    ...(address === undefined ? {} : { address }),
  });

  it("accepts basics with no address (pre-existing leads)", () => {
    expect(isBusinessBasics(basics())).toBe(true);
  });

  it("accepts a string address", () => {
    expect(isBusinessBasics(basics("1420 Bedford Ave"))).toBe(true);
  });

  it("rejects a non-string address", () => {
    expect(isBusinessBasics(basics(42))).toBe(false);
  });

  it("rejects an address longer than the column expects", () => {
    expect(isBusinessBasics(basics("x".repeat(301)))).toBe(false);
  });
});
