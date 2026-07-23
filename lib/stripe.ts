export const SESSION_ID_RE = /^cs_[a-zA-Z0-9_]{8,250}$/;

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

export interface StripeBalanceTransaction {
  id: string;
  amount?: number;
}

// A negative balance transaction is a credit: Stripe subtracts it from the client's next invoice.
// The idempotency key makes a retried settlement return the original transaction, never a second one.
export async function createCustomerBalanceCredit(
  secretKey: string,
  {
    customerId,
    amountCents,
    description,
    idempotencyKey,
  }: { customerId: string; amountCents: number; description: string; idempotencyKey: string },
): Promise<StripeBalanceTransaction | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}/balance_transactions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey,
      },
      body: new URLSearchParams({
        amount: String(-Math.abs(amountCents)),
        currency: "usd",
        description,
      }),
    },
  ).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as StripeBalanceTransaction | null;
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
