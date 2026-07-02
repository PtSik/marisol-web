export type Billing = "monthly" | "annual";

export const BILLING_OPTIONS = ["monthly", "annual"] as const;

export const PRICE: Record<Billing, number> = { monthly: 199, annual: 182 };

export const PLAN_FEATURES = [
  "Unlimited answered calls",
  "Booking + SMS confirmations",
  "Reschedules & no-show reminders",
  "Custom voice & greeting",
  "Keep your current number",
  "Done-for-you setup",
];

export const MULTI_LOCATION_FEATURES = [
  "Everything in Individual",
  "5+ locations",
  "Per-location numbers & menus",
  "Call analytics dashboard",
  "Dedicated onboarding",
];
