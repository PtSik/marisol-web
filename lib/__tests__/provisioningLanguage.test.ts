import { describe, expect, it } from "bun:test";
import type { CheckoutLead } from "@/lib/leads";
import { defaultSetup, validateSetupPayload } from "@/lib/onboarding";
import { buildShopPayload } from "@/lib/provisioning";

const AGENTS = { grooming: "agent_grooming", barber: "agent_barber" };

function lead(overrides: Partial<CheckoutLead> = {}): CheckoutLead {
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
    },
    status: "pending_review",
    setup: defaultSetup("barbershop", ["Haircut"]),
    ...overrides,
  } as CheckoutLead;
}

describe("buildShopPayload — primary_language", () => {
  it("defaults to English for a lead with no locale and no pick", () => {
    const p = buildShopPayload(lead(), "+18336596941", AGENTS);
    expect(p.primary_language).toBe("en");
  });

  // The /es funnel is the strongest signal we have before the client answers the question.
  it("inherits the funnel locale when the client did not pick", () => {
    const p = buildShopPayload(lead({ locale: "es" }), "+18336596941", AGENTS);
    expect(p.primary_language).toBe("es");
  });

  it("lets an explicit pick beat the funnel locale", () => {
    const setup = { ...defaultSetup("barbershop", ["Haircut"]), primaryLanguage: "en" as const };
    const p = buildShopPayload(lead({ locale: "es", setup }), "+18336596941", AGENTS);
    expect(p.primary_language).toBe("en");
  });

  // A single-language mode names the opening tongue outright, so it wins over both the bilingual
  // pick left behind by an earlier answer and the funnel the client arrived through.
  it("takes the opening language from a single-language mode", () => {
    const setup = {
      ...defaultSetup("barbershop", ["Haircut"]),
      languageMode: "es" as const,
      primaryLanguage: "en" as const,
    };
    const p = buildShopPayload(lead({ locale: "en", setup }), "+18336596941", AGENTS);
    expect(p.primary_language).toBe("es");
  });

  it("falls back to the bilingual pick when the mode names no language", () => {
    const setup = {
      ...defaultSetup("barbershop", ["Haircut"]),
      languageMode: "bilingual" as const,
      primaryLanguage: "es" as const,
    };
    const p = buildShopPayload(lead({ locale: "en", setup }), "+18336596941", AGENTS);
    expect(p.primary_language).toBe("es");
  });

  // Every lead created before the mode existed behaves exactly as it did before.
  it("treats a missing mode as bilingual", () => {
    const setup = { ...defaultSetup("barbershop", ["Haircut"]), primaryLanguage: "es" as const };
    const p = buildShopPayload(lead({ locale: "en", setup }), "+18336596941", AGENTS);
    expect(p.primary_language).toBe("es");
  });
});

describe("buildShopPayload — agent per vertical", () => {
  it("pins the barber agent so the shop never relies on the env fallback", () => {
    const p = buildShopPayload(lead(), "+18336596941", AGENTS);
    expect(p.elevenlabs_agent_id).toBe("agent_barber");
  });

  it("pins the grooming agent for a grooming lead", () => {
    const l = lead();
    const p = buildShopPayload(
      { ...l, basics: { ...l.basics, vertical: "grooming" } },
      "+18336596941",
      AGENTS,
    );
    expect(p.elevenlabs_agent_id).toBe("agent_grooming");
  });

  it("omits the agent id when the vertical has none configured", () => {
    const p = buildShopPayload(lead(), "+18336596941", { grooming: "agent_grooming" });
    expect(p.elevenlabs_agent_id).toBeUndefined();
  });
});

describe("validateSetupPayload — primaryLanguage", () => {
  // defaultSetup leaves forwardNumber and staff names blank, which trip earlier guards — fill
  // both so these cases actually reach the language check.
  const base = () => {
    const setup = defaultSetup("barbershop", ["Haircut", "Beard trim", "Cut and beard"]);
    return {
      ...setup,
      forwardNumber: "+13055550111",
      staff: setup.staff.map((m, i) => (i === 0 ? { ...m, name: "Marco" } : m)),
    };
  };

  it("accepts a setup that omits the field entirely (pre-existing leads)", () => {
    expect(validateSetupPayload(base())).toBeNull();
  });

  it("accepts both supported languages", () => {
    expect(validateSetupPayload({ ...base(), primaryLanguage: "en" })).toBeNull();
    expect(validateSetupPayload({ ...base(), primaryLanguage: "es" })).toBeNull();
  });

  // Without this the value reaches the shops CHECK constraint and fails as a raw DB error.
  it("rejects an unsupported language before it can reach provisioning", () => {
    expect(validateSetupPayload({ ...base(), primaryLanguage: "de" })).toBe(
      "invalid primaryLanguage",
    );
  });

  it("accepts every supported language mode", () => {
    expect(validateSetupPayload({ ...base(), languageMode: "en" })).toBeNull();
    expect(validateSetupPayload({ ...base(), languageMode: "es" })).toBeNull();
    expect(validateSetupPayload({ ...base(), languageMode: "bilingual" })).toBeNull();
  });

  it("rejects an unknown language mode", () => {
    expect(validateSetupPayload({ ...base(), languageMode: "trilingual" })).toBe(
      "invalid languageMode",
    );
  });
});
