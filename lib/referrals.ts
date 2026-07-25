import { getLead } from "@/lib/leads";
import { type NotifyEnv, notifyTeam } from "@/lib/notify";
import type { PayoutMethod } from "@/lib/payout";
import { patchAccount } from "@/lib/portalApi";
import { getSubscription } from "@/lib/stripe";
import { type VoiceAgentEnv, voiceAgentFetch } from "@/lib/voiceAgent";

export const REF_COOKIE = "marisol_ref";
export const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
export const REF_CODE_RE = /^[0-9A-Z]{4,16}$/;

const MATURITY_DAYS = 30;
const LIVE_SUBSCRIPTION = new Set(["active", "trialing", "past_due"]);

export type ReferralStatus =
  | "pending"
  | "qualified"
  | "claimable"
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
  referrer?: {
    id: string;
    email: string;
    lead_id?: string | null;
    referral_code: string;
    payout_method?: string | null;
    payout_handle?: string | null;
  } | null;
}

export interface ReferralEnv extends VoiceAgentEnv, NotifyEnv {
  LEADS_KV?: KVNamespace;
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

// Every reward is a manual send: the referrer claims it with a handle, we wire the cash by hand
// and mark it paid in /admin. Returns the cents actually claimed — a second click finds nothing
// claimable left, because the compare-and-set on each referral only lets one claim win.
export async function claimReferralPayout(
  env: ReferralEnv,
  account: { id: string; email: string },
  method: PayoutMethod,
  handle: string,
): Promise<number> {
  await patchAccount(env, account.id, { payout_method: method, payout_handle: handle });

  const claimable = await listReferrals(env, { referrer: account.id, status: "claimable" });
  let claimedCents = 0;
  for (const referral of claimable) {
    const updated = await patchReferral(env, referral.id, {
      status: "payout_requested",
      payout_method: method,
      expected_status: "claimable",
    });
    if (updated) claimedCents += referral.amount_cents;
  }
  if (claimedCents === 0) return 0;

  await notifyTeam(env, `💵 Referral payout claimed — ${account.email}`, {
    accountId: account.id,
    email: account.email,
    method,
    handle,
    send: `$${claimedCents / 100}`,
    note: "Send the cash by hand, then mark it paid out in /admin.",
  });
  return claimedCents;
}

export async function markPaidOut(env: VoiceAgentEnv, id: string): Promise<boolean> {
  const updated = await patchReferral(env, id, {
    status: "paid_out",
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

// Maturity just makes the reward claimable — no money moves until the referrer asks for it,
// so there is no credit to reverse and nothing to double-pay.
async function settleOne(env: ReferralEnv, referral: Referral): Promise<void> {
  const referred = await subscriptionLiveness(env, referral.referred_lead_id);
  if (referred === "unknown") return;
  await patchReferral(
    env,
    referral.id,
    referred === "dead"
      ? { status: "void", settled_at: new Date().toISOString(), expected_status: "qualified" }
      : { status: "claimable", expected_status: "qualified" },
  );
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
