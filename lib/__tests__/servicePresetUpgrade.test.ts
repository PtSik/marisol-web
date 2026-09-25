import { describe, expect, it } from "bun:test";
import { getDict } from "@/lib/i18n/dict";
import { collapseLegacyDurationRanges, defaultSetup, validateSetupPayload } from "@/lib/onboarding";

const en = getDict("en").setup.servicePresets.grooming;

describe("onboarding service examples", () => {
  it("offers one appointment length per grooming example, the longest the job runs", () => {
    const services = defaultSetup("grooming", en).services;
    expect(services.map((s) => s.durationMin)).toEqual(["75", "120", "210", "15"]);
    const setup = {
      ...defaultSetup("grooming", en),
      services,
      forwardNumber: "+13055550100",
      staff: [{ id: "ana", name: "Ana", hours: null }],
    };
    expect(validateSetupPayload(setup)).toBeNull();
  });

  it("keeps the price spread, which is the one range grooming still needs", () => {
    const services = defaultSetup("grooming", en).services;
    expect(services.map((s) => s.priceMax ?? "")).toEqual(["55", "75", "110", ""]);
  });
});

describe("collapseLegacyDurationRanges", () => {
  // A draft saved before durations became a single number. The upper bound is the slot the
  // receptionist now reserves, so keeping the short end would quietly shorten every appointment.
  const legacy = (over: Record<string, string> = {}) =>
    [
      { name: "Full Groom", durationMin: "45", durationMaxMin: "75", price: "40", ...over },
    ] as unknown as ReturnType<typeof defaultSetup>["services"];

  it("collapses a stale range to its upper bound and drops the key", () => {
    expect(collapseLegacyDurationRanges(legacy())).toEqual([
      { name: "Full Groom", durationMin: "75", price: "40" },
    ]);
  });

  it("returns the same array when there is nothing to collapse", () => {
    const services = defaultSetup("grooming", en).services;
    expect(collapseLegacyDurationRanges(services)).toBe(services);
  });
});
