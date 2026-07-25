export type Billing = "monthly" | "annual";
export type Plan = "base" | "premium";

export const BILLING_OPTIONS = ["monthly", "annual"] as const;
export const PLAN_OPTIONS = ["base", "premium"] as const;

export const PLAN_LABELS: Record<Plan, string> = { base: "Base", premium: "Premium" };

export const TRIAL_DAYS = 14;

export const PRICE: Record<Plan, Record<Billing, number>> = {
  base: { monthly: 199, annual: 182 },
  premium: { monthly: 349, annual: 319 },
};

export const premiumSaving = (billing: Billing): number =>
  PRICE.base[billing] * 2 - PRICE.premium[billing];

// What a year on the annual plan saves against paying monthly. Distinct from premiumSaving(), which
// compares Premium against two Base plans.
export const annualSavingPerYear = (plan: Plan): number =>
  (PRICE[plan].monthly - PRICE[plan].annual) * 12;

export const maxAnnualSaving = (): number => Math.max(...PLAN_OPTIONS.map(annualSavingPerYear));

// How many salons each plan's flat price already covers. Salons beyond this are billed as
// extra-location line items on the same subscription.
export const PLAN_SALON_LIMIT: Record<Plan, number> = { base: 1, premium: 2 };

// Per-salon price for every location past the plan's limit — same figures as Base, so an extra
// salon costs $199/mo (or $182/mo billed annually).
export const EXTRA_LOCATION_PRICE: Record<Billing, number> = { monthly: 199, annual: 182 };

export const extraLocationCount = (plan: Plan, totalSalons: number): number =>
  Math.max(0, totalSalons - PLAN_SALON_LIMIT[plan]);
