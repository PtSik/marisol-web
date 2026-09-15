import { normalizeSetup, validateSetupPayload } from "@/lib/onboarding";
import { type OnboardingDraft, REVIEW_STEP } from "@/lib/onboardingDraft";

// No private owner contacts, live shop ID, calendar credentials or phone routing context.
export function previewVariables(draft: OnboardingDraft, locale: "en" | "es") {
  const ready = draft.step === REVIEW_STEP && !validateSetupPayload(normalizeSetup(draft.setup));
  const name = draft.basics.businessName.trim();
  const facts = {
    businessName: name,
    address: draft.basics.address?.trim() || "Not provided",
    ...(ready
      ? {
          timezone: draft.basics.timezone,
          services: draft.setup.services,
          hours: draft.setup.hours,
          staff: draft.setup.staff.map((m) => ({ name: m.name })),
          businessNotes: draft.setup.notes,
        }
      : {
          setup:
            "Services, hours and team have not yet been confirmed. Ask the owner to complete setup for those details.",
        }),
  };
  return {
    preview_greeting:
      locale === "es"
        ? `Hola, gracias por llamar a ${name}. Soy Marisol, la recepcionista virtual. ¿En qué puedo ayudarte?`
        : `Hi, thanks for calling ${name}. I’m Marisol, the AI receptionist. How can I help you?`,
    business_facts: JSON.stringify(facts),
  };
}
