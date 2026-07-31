import type { Billing, Plan } from "@/lib/plans";

export const SESSION_ID_RE = /^cs_[a-zA-Z0-9_]{8,250}$/;

export interface PlanPriceEnv {
  STRIPE_PRICE_BASIC_MONTHLY?: string;
  STRIPE_PRICE_BASIC_ANNUAL?: string;
  STRIPE_PRICE_COMPLETE_MONTHLY?: string;
  STRIPE_PRICE_COMPLETE_ANNUAL?: string;
  STRIPE_PRICE_GROWTH_MONTHLY?: string;
  STRIPE_PRICE_GROWTH_ANNUAL?: string;
}

export function planPriceId(env: PlanPriceEnv, plan: Plan, billing: Billing): string | undefined {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${billing === "annual" ? "ANNUAL" : "MONTHLY"}`;
  return env[key as keyof PlanPriceEnv];
}

export interface StripeCheckoutSession {
  id: string;
  status?: string;
  payment_status?: string;
  customer?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  subscription?: string | null;
  metadata?: Record<string, string>;
}

// A checkout that starts a free trial completes with `no_payment_required`, so payment_status
// alone cannot say the client finished. `status: "complete"` is the only value Stripe documents as
// meaning the session is done — without it a session id copied out of the Checkout URL would pass.
export function checkoutSettled(session: StripeCheckoutSession): boolean {
  if (session.status !== "complete") return false;
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

export interface StripeSubscriptionItem {
  id: string;
  price?: { id?: string; recurring?: { interval?: string } | null } | null;
}

export interface StripeSubscription {
  id: string;
  status?: string;
  trial_end?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  items?: { data?: StripeSubscriptionItem[] } | null;
}

export async function getSubscription(
  secretKey: string,
  subscriptionId: string,
): Promise<StripeSubscription | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  ).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json()) as StripeSubscription;
}

// A cancelled or never-paid subscription has nothing to prorate against, so it can't be upgraded.
export const UPGRADABLE_STATUSES: ReadonlySet<string> = new Set(["trialing", "active", "past_due"]);

// Stripe documents no order for items.data, so the plan can never be taken by index — on an account
// with extra locations that would swap the wrong line item's price.
export function findPlanItem(
  subscription: StripeSubscription | null,
  extraPriceIds: ReadonlySet<string>,
): StripeSubscriptionItem | undefined {
  return (subscription?.items?.data ?? []).find(
    (it) => !it.price?.id || !extraPriceIds.has(it.price.id),
  );
}

// Swapping the price on the existing item keeps one subscription and one cancellation path.
// A trialing subscription keeps its trial_end — Stripe only prorates once the trial converts.
export async function swapSubscriptionPrice(
  secretKey: string,
  {
    subscriptionId,
    itemId,
    priceId,
    plan,
  }: { subscriptionId: string; itemId: string; priceId: string; plan: string },
): Promise<StripeSubscription | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `plan:${subscriptionId}:${priceId}`,
      },
      body: new URLSearchParams({
        "items[0][id]": itemId,
        "items[0][price]": priceId,
        proration_behavior: "create_prorations",
        "metadata[plan]": plan,
      }),
    },
  ).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as StripeSubscription | null;
}

// Sets the extra-location line item on an existing subscription to an absolute quantity, prorated
// to the current period. Absolute (not a delta) so it's idempotent and doubles as the removal path:
// re-derive the salon count and set it, whether a location was added or dropped. Picks the price
// that matches the subscription's own interval — Stripe forbids mixing monthly and yearly items.
export async function setSubscriptionExtraLocations(
  secretKey: string,
  {
    subscription,
    monthlyPriceId,
    annualPriceId,
    quantity,
  }: {
    subscription: StripeSubscription;
    monthlyPriceId: string;
    annualPriceId: string;
    quantity: number;
  },
): Promise<boolean> {
  const items = subscription.items?.data ?? [];
  const extraPriceIds = new Set([monthlyPriceId, annualPriceId]);
  const existing = items.find((it) => it.price?.id && extraPriceIds.has(it.price.id));
  const baseInterval = findPlanItem(subscription, extraPriceIds)?.price?.recurring?.interval;
  const priceId = baseInterval === "year" ? annualPriceId : monthlyPriceId;

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (!existing && quantity <= 0) return true;

  if (existing && quantity <= 0) {
    const res = await fetch(`https://api.stripe.com/v1/subscription_items/${existing.id}`, {
      method: "DELETE",
      headers,
      body: new URLSearchParams({ proration_behavior: "create_prorations" }),
    }).catch(() => null);
    return res?.ok ?? false;
  }

  if (existing) {
    const res = await fetch(`https://api.stripe.com/v1/subscription_items/${existing.id}`, {
      method: "POST",
      headers,
      body: new URLSearchParams({
        quantity: String(quantity),
        proration_behavior: "create_prorations",
      }),
    }).catch(() => null);
    return res?.ok ?? false;
  }

  const res = await fetch("https://api.stripe.com/v1/subscription_items", {
    method: "POST",
    headers,
    body: new URLSearchParams({
      subscription: subscription.id,
      price: priceId,
      quantity: String(quantity),
      proration_behavior: "create_prorations",
    }),
  }).catch(() => null);
  return res?.ok ?? false;
}

export async function createBillingPortalSession(
  secretKey: string,
  customerId: string,
  returnUrl: string,
): Promise<string | null> {
  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ customer: customerId, return_url: returnUrl }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { url?: string } | null;
  return body?.url ?? null;
}

// The referral code doubles as a Stripe promotion code, so we look it up by its human code to get
// the promo id Checkout needs. `active=true` skips codes we've since archived.
export async function findPromotionCode(
  secretKey: string,
  code: string,
): Promise<{ id: string } | null> {
  const params = new URLSearchParams({ code, active: "true", limit: "1" });
  const res = await fetch(`https://api.stripe.com/v1/promotion_codes?${params}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: { id: string }[] } | null;
  return body?.data?.[0] ?? null;
}

// One promo code per referrer, its code equal to their referral code. first_time_transaction keeps
// existing clients from redeeming it.
export async function createReferralPromoCode(
  secretKey: string,
  { code, couponId, accountId }: { code: string; couponId: string; accountId: string },
): Promise<string | null> {
  const res = await fetch("https://api.stripe.com/v1/promotion_codes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      coupon: couponId,
      code,
      "restrictions[first_time_transaction]": "true",
      "metadata[account_id]": accountId,
    }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { id?: string } | null;
  return body?.id ?? null;
}

export async function getCheckoutSession(
  secretKey: string,
  sessionId: string,
): Promise<StripeCheckoutSession | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  ).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json()) as StripeCheckoutSession;
}
