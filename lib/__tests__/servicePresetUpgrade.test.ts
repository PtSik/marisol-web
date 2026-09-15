import { describe, expect, it } from "bun:test";
import { getDict } from "@/lib/i18n/dict";
import {
  defaultSetup,
  fixedOnboardingPresets,
  upgradeUneditedPresetRanges,
  validateSetupPayload,
} from "@/lib/onboarding";

const en = getDict("en").setup.servicePresets.grooming;
const es = getDict("es").setup.servicePresets.grooming;

describe("onboarding service examples", () => {
  it("offers fixed booking lengths that can advance without hidden range errors", () => {
    const services = fixedOnboardingPresets("grooming", en);
    expect(services.map((s) => s.durationMin)).toEqual(["75", "120", "210", "15"]);
    expect(services.every((s) => !s.durationMaxMin)).toBe(true);
    const setup = {
      ...defaultSetup("grooming", en),
      fixedDurations: true,
      services,
      forwardNumber: "+13055550100",
      staff: [{ id: "ana", name: "Ana", hours: null }],
    };
    expect(validateSetupPayload(setup)).toBeNull();
  });

  it("repairs saved untouched EN/ES examples while retaining owner edits", () => {
    const old = defaultSetup("grooming", en).services;
    const edited = { ...old[0], name: "Custom bath", durationMin: "60" };
    const restored = [edited, old[1], old[2], old[3]];
    const upgraded = upgradeUneditedPresetRanges(restored, "grooming", [en, es]);
    expect(upgraded[0]).toBe(edited);
    expect(upgraded[1]).toEqual({ ...old[1], durationMin: "120", durationMaxMin: "" });
    expect(upgraded[2].durationMin).toBe("210");
    expect(upgradeUneditedPresetRanges(upgraded, "grooming", [en, es])).toBe(upgraded);
    const spanish = defaultSetup("grooming", es).services;
    expect(upgradeUneditedPresetRanges(spanish, "grooming", [en, es])[0].durationMin).toBe("75");
  });
});
