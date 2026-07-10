import { env } from "cloudflare:workers";
import { getLead, putLead } from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import { deprovisionLead } from "@/lib/provisioning";
import type { StripeCheckoutSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface WebhookEnv {
  STRIPE_WEBHOOK_SECRET?: string;
  LEADS_KV?: KVNamespace;
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
  RESEND_FROM?: string;
  VOICE_AGENT_API?: Fetcher;
  VOICE_AGENT_API_URL?: string;
  ADMIN_API_KEY?: string;
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
    const sub = event.data?.object as { metadata?: { lead_id?: string } } | undefined;
    const subLeadId = sub?.metadata?.lead_id;
    if (!subLeadId) return Response.json({ received: true });
    const lead = await getLead(cfEnv.LEADS_KV, subLeadId);
    if (!lead || lead.status === "cancelled") return Response.json({ received: true });

    const result = await deprovisionLead(cfEnv, lead);
    lead.status = "cancelled";
    lead.deprovisionedAt = new Date().toISOString();
    await Promise.all([
      putLead(cfEnv.LEADS_KV, lead),
      notifyTeam(cfEnv, `🚫 Cancelled — deprovisioned ${lead.basics.businessName}`, {
        shopId: lead.shopId,
        number: lead.assignedNumber,
        releasedNumber: result.releasedNumber,
        suspendedShop: result.suspendedShop,
      }),
    ]);
    return Response.json({ received: true });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  const session = event.data?.object as StripeCheckoutSession | undefined;
  const leadId = session?.metadata?.lead_id;
  if (!session || !leadId) {
    return Response.json({ received: true });
  }

  // 500 lets Stripe retry — covers KV eventual consistency right after checkout creation
  const lead = await getLead(cfEnv.LEADS_KV, leadId);
  if (!lead) {
    return Response.json({ error: "lead not found" }, { status: 500 });
  }
  if (lead.status === "paid" || lead.status === "setup_complete") {
    return Response.json({ received: true });
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

  return Response.json({ received: true });
}
