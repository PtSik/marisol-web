export type Billing = "monthly" | "annual";
export type Plan = "basic" | "complete" | "growth";

export const BILLING_OPTIONS = ["monthly", "annual"] as const;
export const PLAN_OPTIONS = ["basic", "complete", "growth"] as const;

export const PLAN_LABELS: Record<Plan, string> = {
  basic: "Basic",
  complete: "Complete",
  growth: "Growth",
};

export const TRIAL_DAYS = 14;

// "Two months free" — the annual subscription charges ten months up front, and every annual figure
// on the site is derived from this rather than written down twice.
export const ANNUAL_MONTHS_CHARGED = 10;

const MONTHLY_PRICE: Record<Plan, number> = { basic: 199, complete: 249, growth: 399 };

export const annualTotal = (plan: Plan): number => MONTHLY_PRICE[plan] * ANNUAL_MONTHS_CHARGED;

// The per-month figure the cards show. Rounded down so the headline never overstates what a year
// actually costs — the exact yearly total is printed next to it.
export const PRICE: Record<Plan, Record<Billing, number>> = Object.fromEntries(
  PLAN_OPTIONS.map((plan) => [
    plan,
    { monthly: MONTHLY_PRICE[plan], annual: Math.floor(annualTotal(plan) / 12) },
  ]),
) as Record<Plan, Record<Billing, number>>;

export const annualSavingPerYear = (plan: Plan): number =>
  MONTHLY_PRICE[plan] * (12 - ANNUAL_MONTHS_CHARGED);

export const maxAnnualSaving = (): number => Math.max(...PLAN_OPTIONS.map(annualSavingPerYear));

// How many salons each plan's flat price covers. Salons beyond this are billed as extra-location
// line items on the same subscription.
export const PLAN_SALON_LIMIT: Record<Plan, number> = { basic: 1, complete: 1, growth: 1 };

const EXTRA_LOCATION_MONTHLY = 149;
export const EXTRA_LOCATION_ANNUAL_TOTAL = EXTRA_LOCATION_MONTHLY * ANNUAL_MONTHS_CHARGED;
export const EXTRA_LOCATION_PRICE: Record<Billing, number> = {
  monthly: EXTRA_LOCATION_MONTHLY,
  annual: Math.floor(EXTRA_LOCATION_ANNUAL_TOTAL / 12),
};

// Extra locations start at Complete: on Basic a second salon is an upgrade, not a line item.
export const canAddLocation = (plan: Plan): boolean => plan !== "basic";

export const extraLocationCount = (plan: Plan, totalSalons: number): number =>
  Math.max(0, totalSalons - PLAN_SALON_LIMIT[plan]);

const PLAN_RANK: Record<Plan, number> = { basic: 0, complete: 1, growth: 2 };

// Only upward moves are prorated cleanly by the swap in stripe.ts; a downgrade has to go through
// support so the extra-location quantity and the shop flags can be unwound by hand.
export const isUpgrade = (from: Plan, to: Plan): boolean => PLAN_RANK[to] > PLAN_RANK[from];

export const upgradesFrom = (plan: Plan): Plan[] =>
  PLAN_OPTIONS.filter((candidate) => isUpgrade(plan, candidate));

const LEGACY_PLANS: Record<string, Plan> = { base: "basic", premium: "complete" };

export const normalizePlan = (raw: string | undefined): Plan => {
  if (!raw) return "basic";
  if ((PLAN_OPTIONS as readonly string[]).includes(raw)) return raw as Plan;
  return LEGACY_PLANS[raw] ?? "basic";
};
