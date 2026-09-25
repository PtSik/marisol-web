import { describe, expect, it } from "bun:test";
import { defaultSetup, newStaffEntry, validateSetupPayload } from "@/lib/onboarding";
import { toServiceCatalog } from "@/lib/provisioning";

function svc(over: Partial<ReturnType<typeof base>> = {}) {
  return { ...base(), ...over };
}
function base() {
  return { name: "Full Groom", durationMin: "90", price: "65" } as {
    name: string;
    durationMin: string;
    price: string;
    durationMaxMin?: string;
    priceMax?: string;
  };
}
const catalog = (services: ReturnType<typeof svc>[]) =>
  toServiceCatalog({ services } as Parameters<typeof toServiceCatalog>[0]);

// This is the shop's only record of what it sells: voice-agent books from it and reads it out, so
// anything dropped here is knowledge the receptionist no longer has.
describe("toServiceCatalog", () => {
  it("sends a flat service as a single duration and price", () => {
    expect(catalog([svc()])).toEqual([{ name: "Full Groom", duration_minutes: 90, price: 65 }]);
  });

  it("sends both bounds when the owner gave an upper one", () => {
    expect(catalog([svc({ durationMaxMin: "210", priceMax: "110" })])).toEqual([
      {
        name: "Full Groom",
        duration_minutes: 90,
        duration_max_minutes: 210,
        price: 65,
        price_max: 110,
      },
    ]);
  });

  it("ranges duration and price independently", () => {
    expect(catalog([svc({ durationMaxMin: "210" })])).toEqual([
      { name: "Full Groom", duration_minutes: 90, duration_max_minutes: 210, price: 65 },
    ]);
    expect(catalog([svc({ priceMax: "110" })])).toEqual([
      { name: "Full Groom", duration_minutes: 90, price: 65, price_max: 110 },
    ]);
  });

  it("omits an upper bound equal to the lower one", () => {
    expect(catalog([svc({ durationMaxMin: "90", priceMax: "65" })])).toEqual([
      { name: "Full Groom", duration_minutes: 90, price: 65 },
    ]);
  });

  it("treats a blank upper bound as no range", () => {
    expect(catalog([svc({ durationMaxMin: "  ", priceMax: "" })])).toEqual([
      { name: "Full Groom", duration_minutes: 90, price: 65 },
    ]);
  });

  it("omits a blank price rather than sending zero", () => {
    const entry = catalog([svc({ price: "" })])[0];
    expect(entry).toEqual({ name: "Full Groom", duration_minutes: 90 });
  });

  it("drops unnamed rows", () => {
    expect(catalog([svc({ name: "  " }), svc({ name: "Consult" })])).toEqual([
      { name: "Consult", duration_minutes: 90, price: 65 },
    ]);
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
