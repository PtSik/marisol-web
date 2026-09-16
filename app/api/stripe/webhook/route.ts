import { env } from "cloudflare:workers";
import { enqueueSubscriptionCancellation } from "@/lib/cancellation";
import { settleCheckout } from "@/lib/checkoutSettlement";
import { type CheckoutLead, checkoutCompletionCanAdvance, getLead, putLead } from "@/lib/leads";
import { notifyTeam, sendReviewReceived } from "@/lib/notify";
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
  OUTREACH_DB?: D1Database;
  STRIPE_WEBHOOK_SECRET?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
}

const TOLERANCE_SECONDS = 300;

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

async function cancelSubscriptionSalons(
  cfEnv: WebhookEnv,
  leadId: string | undefined,
  reason: string,
  subscriptionId?: string,
): Promise<void> {
  // Acknowledge only after the cancellation has a durable owner independent of Stripe retries.
  await enqueueSubscriptionCancellation(cfEnv, { leadId, reason, subscriptionId });
}

async function maybeSendReviewReceived(cfEnv: WebhookEnv, lead: CheckoutLead): Promise<void> {
  if (lead.flowVersion !== 2 || lead.reviewEmailSentAt) return;
  const sent = await sendReviewReceived(cfEnv, {
    email: lead.basics.email,
    businessName: lead.basics.businessName,
    ownerName: lead.basics.ownerName,
    locale: lead.locale,
  });
  if (!sent) throw new Error("review confirmation email failed");
  lead.reviewEmailSentAt = new Date().toISOString();
  await putLead(cfEnv.LEADS_KV, lead);
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
    await cancelSubscriptionSalons(cfEnv, leadId, "Cancelled", sub?.id);
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
      await cancelSubscriptionSalons(
        cfEnv,
        sub.metadata?.lead_id,
        "Unpaid — retries exhausted",
        sub.id,
      );
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
    if (lead.status === "pending_review") await maybeSendReviewReceived(cfEnv, lead);
    return received(cfEnv);
  }

  const settled = await settleCheckout(cfEnv.LEADS_KV, session);
  await notifyTeam(
    cfEnv,
    `${settled.status === "pending_review" ? "Setup ready for review" : "PAID — start setup"}: ${settled.basics.businessName}`,
    settled,
  );
  await maybeSendReviewReceived(cfEnv, settled);

  return received(cfEnv);
}
