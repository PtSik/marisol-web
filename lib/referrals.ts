import { getLead } from "@/lib/leads";
import { type NotifyEnv, notifyTeam } from "@/lib/notify";
import { overRateLimit } from "@/lib/rateLimit";
import { createCustomerBalanceCredit, getSubscription } from "@/lib/stripe";
import { type VoiceAgentEnv, voiceAgentFetch } from "@/lib/voiceAgent";

export const REF_COOKIE = "marisol_ref";
export const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
export const REF_CODE_RE = /^[0-9A-Z]{4,16}$/;

const MATURITY_DAYS = 30;
const LIVE_SUBSCRIPTION = new Set(["active", "trialing", "past_due"]);

// Credit is worth the full reward; cash is worth half — we say so up front, everywhere, so the
// button is never a surprise. Reversing an unused credit and wiring money by hand costs us the
// difference, and half keeps the incentive pointed at staying a client.
export const CASH_PAYOUT_BPS = 5000;
export const cashCents = (amountCents: number) =>
  Math.round((amountCents * CASH_PAYOUT_BPS) / 10000);

export type ReferralStatus =
  | "pending"
  | "qualified"
  | "crediting"
  | "credited"
  | "payout_requested"
  | "paid_out"
  | "void";

export interface Referral {
  id: string;
  referrer_account_id: string;
  referred_lead_id: string;
  referred_email?: string | null;
  status: ReferralStatus;
  amount_cents: number;
  payout_method?: string | null;
  payout_ref?: string | null;
  created_at: string;
  qualified_at?: string | null;
  mature_at?: string | null;
  settled_at?: string | null;
  referrer?: { id: string; email: string; lead_id?: string | null; referral_code: string } | null;
}

export interface ReferralEnv extends VoiceAgentEnv, NotifyEnv {
  LEADS_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
  STRIPE_SECRET_KEY?: string;
}

export function refCodeFromCookie(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== REF_COOKIE) continue;
    const value = decodeURIComponent(rest.join("=")).toUpperCase();
    return REF_CODE_RE.test(value) ? value : null;
  }
  return null;
}

async function referralJson(res: Response | null): Promise<Referral | null> {
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { referral?: Referral } | null;
  return body?.referral ?? null;
}

export async function listReferrals(
  env: VoiceAgentEnv,
  query: Record<string, string>,
): Promise<Referral[]> {
  const search = new URLSearchParams(query).toString();
  const res = await voiceAgentFetch(env, `/admin/referrals?${search}`).catch(() => null);
  if (!res?.ok) return [];
  const body = (await res.json().catch(() => null)) as { referrals?: Referral[] } | null;
  return body?.referrals ?? [];
}

async function patchReferral(
  env: VoiceAgentEnv,
  id: string,
  update: Record<string, unknown>,
): Promise<Referral | null> {
  const res = await voiceAgentFetch(env, `/admin/referrals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  }).catch(() => null);
  return referralJson(res);
}

export async function registerReferral(
  env: VoiceAgentEnv,
  referral: { referral_code: string; referred_lead_id: string; referred_email?: string },
): Promise<Referral | null> {
  const res = await voiceAgentFetch(env, "/admin/referrals", {
    method: "POST",
    body: JSON.stringify(referral),
  }).catch(() => null);
  return referralJson(res);
}

export async function qualifyReferral(env: VoiceAgentEnv, leadId: string): Promise<void> {
  const [referral] = await listReferrals(env, { referred_lead_id: leadId, status: "pending" });
  if (!referral) return;
  const now = new Date();
  const matureAt = new Date(now.getTime() + MATURITY_DAYS * 24 * 60 * 60 * 1000);
  await patchReferral(env, referral.id, {
    status: "qualified",
    qualified_at: now.toISOString(),
    mature_at: matureAt.toISOString(),
    expected_status: "pending",
  });
}

// Cancelled, refunded or churned before maturity: the referral dies with the subscription.
export async function voidReferral(env: VoiceAgentEnv, leadId: string): Promise<void> {
  const referrals = await listReferrals(env, { referred_lead_id: leadId });
  for (const referral of referrals) {
    if (referral.status !== "pending" && referral.status !== "qualified") continue;
    await patchReferral(env, referral.id, {
      status: "void",
      settled_at: new Date().toISOString(),
      expected_status: referral.status,
    });
  }
}

// Cash is the manual track: we flag the credited referrals and settle them by hand in /admin.
export async function requestCashPayout(env: VoiceAgentEnv, accountId: string): Promise<number> {
  const credited = await listReferrals(env, { referrer: accountId, status: "credited" });
  let requested = 0;
  for (const referral of credited) {
    const updated = await patchReferral(env, referral.id, {
      status: "payout_requested",
      payout_method: "cash",
      expected_status: "credited",
    });
    if (updated) requested += 1;
  }
  return requested;
}

export async function markPaidOut(env: VoiceAgentEnv, id: string): Promise<boolean> {
  const updated = await patchReferral(env, id, {
    status: "paid_out",
    payout_method: "cash",
    settled_at: new Date().toISOString(),
    expected_status: "payout_requested",
  });
  return Boolean(updated);
}

// "unknown" is not "dead": a missing key or an unreachable Stripe must never void a real
// referral — the next settlement pass asks again.
type Liveness = "live" | "dead" | "unknown";

async function subscriptionLiveness(env: ReferralEnv, leadId?: string | null): Promise<Liveness> {
  if (!leadId) return "unknown";
  const lead = await getLead(env.LEADS_KV, leadId);
  if (!lead) return "unknown";
  if (lead.status === "cancelled") return "dead";
  if (!env.STRIPE_SECRET_KEY || !lead.stripeSubscriptionId) return "unknown";
  const subscription = await getSubscription(env.STRIPE_SECRET_KEY, lead.stripeSubscriptionId);
  if (!subscription?.status) return "unknown";
  return LIVE_SUBSCRIPTION.has(subscription.status) ? "live" : "dead";
}

async function referrerCustomerId(env: ReferralEnv, referral: Referral): Promise<string | null> {
  const leadId = referral.referrer?.lead_id;
  if (!leadId) return null;
  const lead = await getLead(env.LEADS_KV, leadId);
  return lead?.stripeCustomerId ?? null;
}

async function settleOne(env: ReferralEnv, referral: Referral): Promise<void> {
  const referred = await subscriptionLiveness(env, referral.referred_lead_id);
  if (referred === "unknown") return;
  if (referred === "dead") {
    await patchReferral(env, referral.id, {
      status: "void",
      settled_at: new Date().toISOString(),
      expected_status: "qualified",
    });
    return;
  }

  // The claim is the lock: whoever wins the compare-and-set books the credit, everyone else
  // gets a 409 and walks away, so two webhooks landing together can't pay $200 twice.
  const claimed = await patchReferral(env, referral.id, {
    status: "crediting",
    expected_status: "qualified",
  });
  if (!claimed) return;

  const customerId = await referrerCustomerId(env, referral);
  if (!customerId || !env.STRIPE_SECRET_KEY) {
    await patchReferral(env, referral.id, { status: "qualified", expected_status: "crediting" });
    // Settlement retries on every webhook, so the alert is throttled to one a week per referral.
    const alerted = await overRateLimit(
      env.RATE_LIMIT_KV,
      `refalert:${referral.id}`,
      1,
      7 * 24 * 60 * 60,
    );
    if (!alerted) {
      await notifyTeam(env, "💰 Referral matured but has no Stripe customer — pay it manually", {
        referralId: referral.id,
        referrer: referral.referrer?.email,
        referredLeadId: referral.referred_lead_id,
        amount: `$${referral.amount_cents / 100}`,
      });
    }
    return;
  }

  const transaction = await createCustomerBalanceCredit(env.STRIPE_SECRET_KEY, {
    customerId,
    amountCents: referral.amount_cents,
    description: `Marisol referral reward (${referral.referred_lead_id})`,
    idempotencyKey: `referral:${referral.id}`,
  });
  if (!transaction) {
    await patchReferral(env, referral.id, { status: "qualified", expected_status: "crediting" });
    return;
  }

  await patchReferral(env, referral.id, {
    status: "credited",
    payout_method: "credit",
    payout_ref: transaction.id,
    settled_at: new Date().toISOString(),
    expected_status: "crediting",
  });

  // Credit still goes out to a churned referrer — they earned it — but an unused balance is
  // worthless to them, so the team hears about it and can offer cash.
  if ((await subscriptionLiveness(env, referral.referrer?.lead_id)) === "dead") {
    await notifyTeam(env, "💰 Referral credited to a client with no live subscription", {
      referralId: referral.id,
      referrer: referral.referrer?.email,
      note: "The $200 sits on their Stripe balance — they may want it as cash instead.",
    });
  }
}

// Runs on every Stripe webhook and every /portal/referrals render, which is what replaces a cron.
// Never throws: a failed settlement must not take down the webhook or the page that triggered it.
export async function settleMatureReferrals(env: ReferralEnv): Promise<void> {
  try {
    const due = await listReferrals(env, {
      status: "qualified",
      mature_before: new Date().toISOString(),
    });
    for (const referral of due) {
      await settleOne(env, referral).catch(() => {});
    }
  } catch {
    /* settlement is best-effort; the next webhook or page view retries */
  }
}
