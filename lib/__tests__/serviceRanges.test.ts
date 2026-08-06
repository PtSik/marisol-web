import { describe, expect, it } from "bun:test";
import { defaultSetup, newStaffEntry, validateSetupPayload } from "@/lib/onboarding";
import { toShopServices } from "@/lib/provisioning";

function svc(over: Partial<Parameters<typeof toShopServices>[0][number]> = {}) {
  return { name: "Full Groom", durationMin: "90", price: "65", ...over };
}

describe("toShopServices", () => {
  it("keeps a flat value when no upper bound is given", () => {
    expect(toShopServices([svc()])).toEqual(["Full Groom — 90 min / $65"]);
  });

  it("renders a range when the owner gave an upper bound", () => {
    expect(toShopServices([svc({ durationMaxMin: "210", priceMax: "110" })])).toEqual([
      "Full Groom — 90-210 min / $65-110",
    ]);
  });

  it("ranges duration and price independently", () => {
    expect(toShopServices([svc({ durationMaxMin: "210" })])).toEqual([
      "Full Groom — 90-210 min / $65",
    ]);
    expect(toShopServices([svc({ priceMax: "110" })])).toEqual(["Full Groom — 90 min / $65-110"]);
  });

  it("collapses an upper bound equal to the lower one", () => {
    expect(toShopServices([svc({ durationMaxMin: "90", priceMax: "65" })])).toEqual([
      "Full Groom — 90 min / $65",
    ]);
  });

  it("treats a blank upper bound as no range", () => {
    expect(toShopServices([svc({ durationMaxMin: "  ", priceMax: "" })])).toEqual([
      "Full Groom — 90 min / $65",
    ]);
  });

  // personalization.ts joins the array with ", ", so a comma inside an entry left the agent unable to
  // tell where one service ended — which is why it hedged on pricing instead of quoting.
  it("separates fields with a delimiter the array join does not reuse", () => {
    const line = toShopServices([svc({ durationMaxMin: "210", priceMax: "110" })])[0];
    expect(line).not.toContain(",");
  });

  it("drops unnamed rows and keeps name-only ones intact", () => {
    expect(
      toShopServices([svc({ name: "  " }), { name: "Consult", durationMin: "", price: "" }]),
    ).toEqual(["Consult"]);
  });
});

describe("validateSetupPayload — service ranges", () => {
  // Mirrors the fixture in onboarding.test.ts: a setup both sides already accept, so each case
  // changes exactly one thing — the services.
  const setup = (services: ReturnType<typeof svc>[]) => ({
    ...defaultSetup("grooming", ["Bath", "Full Groom", "Full Groom XL", "Nail trim"]),
    forwardNumber: "+1 305 555 0101",
    staff: [{ ...newStaffEntry(), name: "Maria", hours: null }],
    services,
  });

  it("accepts a service with no upper bounds at all", () => {
    expect(validateSetupPayload(setup([svc()]))).toBeNull();
  });

  it("accepts well-formed ranges", () => {
    expect(
      validateSetupPayload(setup([svc({ durationMaxMin: "210", priceMax: "110" })])),
    ).toBeNull();
  });

  it("rejects a duration whose upper bound is below its lower bound", () => {
    expect(validateSetupPayload(setup([svc({ durationMaxMin: "30" })]))).toBe("invalid services");
  });

  it("rejects a price whose upper bound is below its lower bound", () => {
    expect(validateSetupPayload(setup([svc({ priceMax: "10" })]))).toBe("invalid services");
  });

  it("allows an upper bound equal to the lower bound", () => {
    expect(validateSetupPayload(setup([svc({ durationMaxMin: "90", priceMax: "65" })]))).toBeNull();
  });
});
