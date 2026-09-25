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

  it("sends the price ceiling when the owner gave one", () => {
    expect(catalog([svc({ priceMax: "110" })])).toEqual([
      { name: "Full Groom", duration_minutes: 90, price: 65, price_max: 110 },
    ]);
  });

  it("omits a price ceiling equal to the price", () => {
    expect(catalog([svc({ priceMax: "65" })])).toEqual([
      { name: "Full Groom", duration_minutes: 90, price: 65 },
    ]);
  });

  it("treats a blank price ceiling as no range", () => {
    expect(catalog([svc({ priceMax: "" })])).toEqual([
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

describe("validateSetupPayload — price ranges", () => {
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

  it("accepts a well-formed price range", () => {
    expect(validateSetupPayload(setup([svc({ priceMax: "110" })]))).toBeNull();
  });

  it("rejects a price whose ceiling is below its floor", () => {
    expect(validateSetupPayload(setup([svc({ priceMax: "10" })]))).toBe("invalid services");
  });

  it("allows a ceiling equal to the price", () => {
    expect(validateSetupPayload(setup([svc({ priceMax: "65" })]))).toBeNull();
  });
});
