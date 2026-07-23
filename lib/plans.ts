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
