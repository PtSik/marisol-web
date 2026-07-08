export type Billing = "monthly" | "annual";
export type Plan = "base" | "premium";

export const BILLING_OPTIONS = ["monthly", "annual"] as const;
export const PLAN_OPTIONS = ["base", "premium"] as const;

export const PLAN_LABELS: Record<Plan, string> = { base: "Base", premium: "Premium" };

export const PRICE: Record<Plan, Record<Billing, number>> = {
  base: { monthly: 199, annual: 182 },
  premium: { monthly: 349, annual: 319 },
};

export const BASE_FEATURES = [
  "24/7 answering in English & Spanish",
  "Bookings, reschedules & cancellations",
  "Instant SMS booking confirmations",
  "Google Calendar sync",
  "Up to 400 answered calls a month",
  "Keep your current number",
  "Done-for-you setup",
];

export const PREMIUM_FEATURES = [
  "Everything in Base",
  "Unlimited answered calls",
  "SMS appointment reminders — fewer no-shows",
  "Rebooking nudges that refill your calendar",
  "Custom voice & receptionist persona",
  "2 locations included — $99/mo each extra",
  "Priority support & 1:1 onboarding",
];
