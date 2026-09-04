import { env } from "cloudflare:workers";
import {
  type CheckoutLead,
  checkoutCompletionCanAdvance,
  getLead,
  getLeadIdForShop,
  getLeadStrict,
  putLead,
} from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import { type Shop, getShop, listAccountShopsStrict } from "@/lib/portalApi";
import { deprovisionLead, deprovisionShop } from "@/lib/provisioning";
import {
  type ReferralEnv,
  maybeSendReferralInvite,
  qualifyReferral,
  registerReferral,
  settleMatureReferrals,
  voidReferral,
} from "@/lib/referrals";
import { type StripeCheckoutSession, getSubscription } from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface WebhookEnv extends ReferralEnv {
  STRIPE_WEBHOOK_SECRET?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
}

const TOLERANCE_SECONDS = 300;

type CancellationOutcome = "complete" | "retryable" | "unresolvable";

interface StripeEvent {
  type?: string;
  data?: { object?: Record<string, unknown> };
}

function parseSignatureHeader(header: string | null): { timestamp: number; v1: string[] } | null {
  if (!header) return null;
  let timestamp = 0;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && value) v1.push(value);
  }
  return timestamp > 0 && v1.length > 0 ? { timestamp, v1 } : null;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function signatureValid(
  secret: string,
  timestamp: number,
  signatures: string[],
  body: string,
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const payload = enc.encode(`${timestamp}.${body}`);
  for (const signature of signatures) {
    const bytes = hexToBytes(signature);
    if (bytes && (await crypto.subtle.verify("HMAC", key, bytes, payload))) return true;
  }
  return false;
}

interface StripeSubscription {
  id?: string;
  status?: string;
  metadata?: { lead_id?: string };
}

interface StripeInvoice {
  amount_paid?: number;
  subscription?: string | null;
  subscription_details?: { metadata?: { lead_id?: string } | null } | null;
}

// Every webhook doubles as the settlement tick that replaces a cron.
async function received(cfEnv: WebhookEnv): Promise<Response> {
  await settleMatureReferrals(cfEnv);
  return Response.json({ received: true });
}

async function leadIdForInvoice(cfEnv: WebhookEnv, invoice: StripeInvoice): Promise<string | null> {
  const fromDetails = invoice.subscription_details?.metadata?.lead_id;
  if (fromDetails) return fromDetails;
  if (!cfEnv.STRIPE_SECRET_KEY || !invoice.subscription) return null;
  const subscription = await getSubscription(cfEnv.STRIPE_SECRET_KEY, invoice.subscription);
  return subscription?.metadata?.lead_id ?? null;
}

async function leadForSubscription(
  cfEnv: WebhookEnv,
  sub: StripeSubscription | undefined,
): Promise<CheckoutLead | null> {
  const leadId = sub?.metadata?.lead_id;
  if (!leadId) return null;
  const lead = await getLead(cfEnv.LEADS_KV, leadId);
  return lead && lead.status !== "cancelled" ? lead : null;
}

async function cancelLead(cfEnv: WebhookEnv, lead: CheckoutLead, reason: string): Promise<boolean> {
  const result = await deprovisionLead(cfEnv, lead);
  lead.status = result.complete ? "cancelled" : "cancellation_pending";
  if (result.complete) {
    lead.deprovisionedAt = new Date().toISOString();
    lead.cancellationPendingAt = undefined;
  } else {
    lead.cancellationPendingAt = lead.cancellationPendingAt ?? new Date().toISOString();
  }
  await Promise.all([
    putLead(cfEnv.LEADS_KV, lead),
    notifyTeam(
      cfEnv,
      result.complete
        ? `🚫 ${reason} — deprovisioned ${lead.basics.businessName}`
        : `🛑 ${reason} — deprovision incomplete for ${lead.basics.businessName}`,
      {
        shopId: lead.shopId,
        number: lead.assignedNumber,
        releasedNumber: result.releasedNumber,
        suspendedShop: result.suspendedShop,
        cancelledShop: result.cancelledShop,
      },
    ),
  ]);
  return result.complete;
}

async function leadForShop(cfEnv: WebhookEnv, shopId: string): Promise<CheckoutLead | null> {
  const leadId = await getLeadIdForShop(cfEnv.LEADS_KV, shopId);
  return leadId ? await getLead(cfEnv.LEADS_KV, leadId) : null;
}

async function cancelOrphanShop(cfEnv: WebhookEnv, shop: Shop, reason: string): Promise<boolean> {
  const result = await deprovisionShop(cfEnv, shop.id, shop.twilio_number);
  await notifyTeam(
    cfEnv,
    result.complete
      ? `🚫 ${reason} — deprovisioned ${shop.name ?? shop.id} (no lead on file)`
      : `🛑 ${reason} — deprovision incomplete for ${shop.name ?? shop.id} (no lead on file)`,
    {
      shopId: shop.id,
      number: shop.twilio_number,
      releasedNumber: result.releasedNumber,
      suspendedShop: result.suspendedShop,
      cancelledShop: result.cancelledShop,
    },
  );
  return result.complete;
}

// One subscription now backs every salon on an account, so cancelling it must tear down all of
// them — not just the primary lead in the subscription metadata. Enumerate the account's live
// shops and deprovision each through its own lead (falling back to the shop row when the lead
// index is missing). Legacy accounts with no account_id link keep the single-lead teardown.
async function cancelSubscriptionSalons(
  cfEnv: WebhookEnv,
  leadId: string | undefined,
  reason: string,
  subscriptionId?: string,
): Promise<CancellationOutcome> {
  if (!leadId) {
    await notifyTeam(cfEnv, `🛑 ${reason} — Stripe subscription has no lead_id`, {
      reason,
      subscriptionId,
    });
    // No retry can invent metadata on the delivered Stripe object. Acknowledge after alerting so a
    // manual/out-of-funnel subscription cannot poison the whole webhook endpoint for days.
    return "unresolvable";
  }
  let primary: CheckoutLead | null;
  try {
    primary = await getLeadStrict(cfEnv.LEADS_KV, leadId);
  } catch (error) {
    await notifyTeam(cfEnv, `🛑 ${reason} — lead lookup temporarily unavailable`, {
      leadId,
      subscriptionId,
      error: error instanceof Error ? error.message : "KV lookup failed",
    });
    return "retryable";
  }
  if (!primary) {
    await notifyTeam(cfEnv, `🛑 ${reason} — Stripe lead no longer exists`, {
      leadId,
      subscriptionId,
    });
    // A confirmed KV miss is permanent. There is no safe resource mapping to act on automatically.
    return "unresolvable";
  }

  const accountId =
    primary.accountId ??
    (primary.shopId
      ? ((await getShop(cfEnv, primary.shopId))?.account_id ?? undefined)
      : undefined);
  if (!accountId) {
    if (primary.status === "cancelled") return "complete";
    return (await cancelLead(cfEnv, primary, reason)) ? "complete" : "retryable";
  }

  const accountShops = await listAccountShopsStrict(cfEnv, accountId);
  if (!accountShops) {
    await notifyTeam(cfEnv, `🛑 ${reason} — could not list all account salons`, {
      accountId,
      leadId,
    });
    return "retryable";
  }
  const shops = accountShops.filter((s) => s.status !== "cancelled");
  let handledPrimary = false;
  let complete = true;
  for (const shop of shops) {
    if (shop.id === primary.shopId) handledPrimary = true;
    const lead = shop.id === primary.shopId ? primary : await leadForShop(cfEnv, shop.id);
    if (lead) {
      if (lead.status !== "cancelled") {
        complete = (await cancelLead(cfEnv, lead, reason)) && complete;
      }
    } else {
      complete = (await cancelOrphanShop(cfEnv, shop, reason)) && complete;
    }
  }
  // The listing dropped the primary salon (or failed) — never leave the anchor salon live.
  if (!handledPrimary && primary.status !== "cancelled") {
    complete = (await cancelLead(cfEnv, primary, reason)) && complete;
  }
  return complete ? "complete" : "retryable";
}

export async function POST(request: Request) {
  const cfEnv = env as unknown as WebhookEnv;
  if (!cfEnv.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "webhook not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = parseSignatureHeader(request.headers.get("Stripe-Signature"));
  if (!sig || Math.abs(Date.now() / 1000 - sig.timestamp) > TOLERANCE_SECONDS) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }
  if (!(await signatureValid(cfEnv.STRIPE_WEBHOOK_SECRET, sig.timestamp, sig.v1, body))) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data?.object as StripeSubscription | undefined;
    const leadId = sub?.metadata?.lead_id;
    if (leadId) await voidReferral(cfEnv, leadId);
    if ((await cancelSubscriptionSalons(cfEnv, leadId, "Cancelled", sub?.id)) === "retryable") {
      return Response.json({ error: "deprovision incomplete" }, { status: 500 });
    }
    return received(cfEnv);
  }

  // The trial ends with the first real charge — that is when a referral has actually earned
  // something, so it starts its 30-day maturity clock here.
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data?.object as StripeInvoice | undefined;
    if (!invoice?.amount_paid) return received(cfEnv);
    const leadId = await leadIdForInvoice(cfEnv, invoice);
    if (leadId) {
      await qualifyReferral(cfEnv, leadId);
      // Same moment from the other side: this client has now paid, so ask them to refer someone.
      await maybeSendReferralInvite(cfEnv, leadId);
    }
    return received(cfEnv);
  }

  // Retries exhausted: whether Stripe then cancels, marks unpaid or leaves the subscription past
  // due is a dashboard setting, so we react to the status itself rather than trusting it to end
  // in a `deleted` event — otherwise a non-paying client keeps a number we pay for.
  if (event.type === "customer.subscription.updated") {
    const sub = event.data?.object as StripeSubscription | undefined;
    if (sub?.status !== "unpaid" && sub?.status !== "past_due") {
      return received(cfEnv);
    }

    if (sub.status === "unpaid") {
      if (
        (await cancelSubscriptionSalons(
          cfEnv,
          sub.metadata?.lead_id,
          "Unpaid — retries exhausted",
          sub.id,
        )) === "retryable"
      ) {
        return Response.json({ error: "deprovision incomplete" }, { status: 500 });
      }
      return received(cfEnv);
    }

    // past_due: an informational alert only, keyed on the account's primary lead.
    const lead = await leadForSubscription(cfEnv, sub);
    if (!lead) return received(cfEnv);
    if (!lead.pastDueAlertedAt) {
      lead.pastDueAlertedAt = new Date().toISOString();
      await Promise.all([
        putLead(cfEnv.LEADS_KV, lead),
        notifyTeam(cfEnv, `💸 Payment failed — ${lead.basics.businessName} is past due`, {
          shopId: lead.shopId,
          number: lead.assignedNumber,
          email: lead.basics.email,
          note: "Stripe is retrying. Service stays live until the retries run out.",
        }),
      ]);
    }
    return received(cfEnv);
  }

  if (event.type !== "checkout.session.completed") {
    return received(cfEnv);
  }

  const session = event.data?.object as StripeCheckoutSession | undefined;
  const leadId = session?.metadata?.lead_id;
  if (!session || !leadId) {
    return received(cfEnv);
  }

  const referralCode = session.metadata?.referral_code;
  if (referralCode) {
    await registerReferral(cfEnv, {
      referral_code: referralCode,
      referred_lead_id: leadId,
      referred_email: session.customer_details?.email ?? session.customer_email ?? undefined,
    });
  }

  // 500 lets Stripe retry — covers KV eventual consistency right after checkout creation
  const lead = await getLead(cfEnv.LEADS_KV, leadId);
  if (!lead) {
    return Response.json({ error: "lead not found" }, { status: 500 });
  }
  if (!checkoutCompletionCanAdvance(lead.status)) {
    return received(cfEnv);
  }

  lead.status = "paid";
  lead.paidAt = new Date().toISOString();
  lead.stripeSessionId = session.id;
  if (typeof session.customer === "string") lead.stripeCustomerId = session.customer;
  if (typeof session.subscription === "string") lead.stripeSubscriptionId = session.subscription;

  await Promise.all([
    putLead(cfEnv.LEADS_KV, lead),
    notifyTeam(cfEnv, `PAID — start setup: ${lead.basics.businessName}`, lead),
  ]);

  return received(cfEnv);
}
