import { describe, expect, it } from "bun:test";
import { defaultBasics, defaultSetup } from "@/lib/onboarding";
import { type OnboardingDraft, REVIEW_STEP } from "@/lib/onboardingDraft";
import { previewVariables } from "@/lib/onboardingPreview";

function draft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  const setup = defaultSetup("barbershop", ["Haircut", "Beard trim", "Haircut + beard"]);
  return {
    basics: {
      ...defaultBasics("barbershop"),
      businessName: "Fade District",
      ownerName: "Alex Rivera",
      email: "alex@fadedistrict.com",
      businessPhone: "+13055550100",
      ownerMobile: "+13055550111",
      address: "1420 Bedford Ave, Brooklyn, NY 11216",
    },
    setup: {
      ...setup,
      forwardNumber: "+13055550100",
      staff: setup.staff.map((m, i) => (i === 0 ? { ...m, name: "Marco" } : m)),
    },
    step: REVIEW_STEP,
    plan: "basic",
    billing: "monthly",
    ...overrides,
  };
}

const facts = (d: OnboardingDraft) =>
  JSON.parse(previewVariables(d, "en").business_facts) as Record<string, unknown>;

// The wizard decides where to offer the preview from this gate. If it ever widened, an "updated
// receptionist" heading would sit above a call that still knows nothing about the setup.
describe("previewVariables — what the agent is told", () => {
  it("withholds services, hours and team before the review step", () => {
    for (const step of [0, 1, 2, 3, 4]) {
      const f = facts(draft({ step }));
      expect(f.services).toBeUndefined();
      expect(f.hours).toBeUndefined();
      expect(f.staff).toBeUndefined();
      expect(String(f.setup)).toContain("have not yet been confirmed");
    }
  });

  it("withholds them at review too while the setup is still invalid", () => {
    const base = draft();
    const f = facts({ ...base, setup: { ...base.setup, forwardNumber: "" } });
    expect(f.services).toBeUndefined();
    expect(String(f.setup)).toContain("have not yet been confirmed");
  });

  it("supplies the confirmed setup once review is reached and the setup validates", () => {
    const f = facts(draft());
    expect(f.setup).toBeUndefined();
    expect(f.services).toHaveLength(3);
    expect(f.hours).toBeDefined();
    expect(f.staff).toEqual([{ name: "Marco" }]);
    expect(f.timezone).toBe("America/New_York");
  });

  it("always carries the business name and address", () => {
    const f = facts(draft({ step: 0 }));
    expect(f.businessName).toBe("Fade District");
    expect(f.address).toBe("1420 Bedford Ave, Brooklyn, NY 11216");
  });

  it("marks a missing address rather than inventing one", () => {
    const base = draft({ step: 0 });
    const f = facts({ ...base, basics: { ...base.basics, address: "" } });
    expect(f.address).toBe("Not provided");
  });

  // The preview agent is reachable from a browser session, so the owner's private contacts must
  // never ride along in its variables.
  it("leaks no owner contact details in either locale", () => {
    for (const locale of ["en", "es"] as const) {
      const serialized = JSON.stringify(previewVariables(draft(), locale));
      expect(serialized).not.toContain("+13055550111");
      expect(serialized).not.toContain("alex@fadedistrict.com");
      expect(serialized).not.toContain("Alex Rivera");
    }
  });

  it("greets in the requested language", () => {
    expect(previewVariables(draft(), "en").preview_greeting).toContain("thanks for calling Fade");
    expect(previewVariables(draft(), "es").preview_greeting).toContain("gracias por llamar a Fade");
  });
});
