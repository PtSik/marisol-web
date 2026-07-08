import { env } from "cloudflare:workers";
import { type CheckoutLead, getLead, putLead } from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import {
  type BusinessBasics,
  DAYS,
  EMAIL_RE,
  PHONE_RE,
  type SetupDetails,
  VERTICAL_IDS,
} from "@/lib/onboarding";
import { BILLING_OPTIONS, type Billing, PLAN_OPTIONS, type Plan } from "@/lib/plans";
import { overRateLimit } from "@/lib/rateLimit";
import { SESSION_ID_RE, type StripeCheckoutSession, getCheckoutSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface OnboardingEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
  STRIPE_PRICE_PREMIUM_MONTHLY?: string;
  STRIPE_PRICE_PREMIUM_ANNUAL?: string;
  LEADS_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
  RESEND_FROM?: string;
}

interface CallRequest {
  name: string;
  email: string;
  phone: string;
  preferredTime: string;
  question: string;
}

interface OnboardingRequest {
  intent: "checkout" | "call" | "setup";
  plan?: Plan;
  billing?: Billing;
  basics?: BusinessBasics;
  call?: CallRequest;
  sessionId?: string;
  setup?: SetupDetails;
}

const RATE_LIMITS: Record<OnboardingRequest["intent"], number> = {
  checkout: 10,
  call: 5,
  setup: 20,
};

const TIME_RE = /^\d{2}:\d{2}$/;

function isShortString(value: unknown, max = 120): value is string {
  return typeof value === "string" && value.length <= max;
}

function validateCall(call: unknown): string | null {
  if (typeof call !== "object" || call === null) return "invalid call";
  const c = call as CallRequest;
  if (!isShortString(c.name) || !c.name.trim()) return "invalid name";
  if (!isShortString(c.email) || !EMAIL_RE.test(c.email)) return "invalid email";
  if (!isShortString(c.phone) || !PHONE_RE.test(c.phone)) return "invalid phone";
  if (!isShortString(c.preferredTime, 200)) return "invalid preferredTime";
  if (typeof c.question !== "string" || c.question.length > 2000) return "invalid question";
  return null;
}

function validateBasics(basics: unknown): string | null {
  if (typeof basics !== "object" || basics === null) return "invalid basics";
  const b = basics as BusinessBasics;
  if (!isShortString(b.email) || !EMAIL_RE.test(b.email)) return "invalid email";
  if (!VERTICAL_IDS.includes(b.vertical)) return "invalid vertical";
  if (!isShortString(b.businessName) || !b.businessName.trim()) return "invalid businessName";
  if (!isShortString(b.ownerName) || !b.ownerName.trim()) return "invalid ownerName";
  for (const field of ["businessPhone", "ownerMobile"] as const) {
    if (!isShortString(b[field]) || !PHONE_RE.test(b[field])) return `invalid ${field}`;
  }
  if (!isShortString(b.timezone, 60)) return "invalid timezone";
  return null;
}

function validateSetup(setup: unknown): string | null {
  if (typeof setup !== "object" || setup === null) return "invalid setup";
  const s = setup as SetupDetails;

  if (!isShortString(s.forwardNumber) || !PHONE_RE.test(s.forwardNumber))
    return "invalid forwardNumber";
  if (s.calendar !== "google_calendar" && s.calendar !== "none") return "invalid calendar";
  if (typeof s.notes !== "string" || s.notes.length > 2000) return "invalid notes";

  if (typeof s.hours !== "object" || s.hours === null) return "invalid hours";
  for (const day of DAYS) {
    const h = s.hours[day.id];
    if (typeof h?.closed !== "boolean" || !TIME_RE.test(h.open) || !TIME_RE.test(h.close))
      return "invalid hours";
    if (!h.closed && h.open >= h.close) return "invalid hours";
  }

  if (!Array.isArray(s.services) || s.services.length === 0 || s.services.length > 30)
    return "invalid services";
  const hasService = s.services.some(
    (svc) => isShortString(svc?.name) && svc.name.trim() && Number(svc?.durationMin) > 0,
  );
  if (
    !hasService ||
    !s.services.every(
      (svc) =>
        isShortString(svc?.name) &&
        isShortString(svc?.durationMin, 5) &&
        isShortString(svc?.price, 10),
    )
  )
    return "invalid services";

  if (
    !Array.isArray(s.staff) ||
    s.staff.length > 30 ||
    !s.staff.some((m) => isShortString(m) && m.trim()) ||
    !s.staff.every((m) => isShortString(m))
  )
    return "invalid staff";

  return null;
}

function reconstructLead(leadId: string, session: StripeCheckoutSession): CheckoutLead {
  const meta = session.metadata ?? {};
  const vertical = VERTICAL_IDS.includes(meta.vertical as never)
    ? (meta.vertical as CheckoutLead["basics"]["vertical"])
    : "barbershop";
  return {
    id: leadId,
    createdAt: new Date().toISOString(),
    intent: "checkout",
    plan: meta.plan === "premium" ? "premium" : "base",
    billing: meta.billing === "annual" ? "annual" : "monthly",
    basics: {
      vertical,
      businessName: meta.business_name ?? "",
      ownerName: meta.owner_name ?? "",
      email: session.customer_details?.email ?? session.customer_email ?? "",
      businessPhone: meta.business_phone ?? "",
      ownerMobile: "",
      timezone: "",
    },
    status: "created",
  };
}

async function handleCheckout(
  cfEnv: OnboardingEnv,
  request: Request,
  plan: Plan,
  billing: Billing,
  basics: BusinessBasics,
): Promise<Response> {
  const lead: CheckoutLead = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    intent: "checkout",
    plan,
    billing,
    basics,
    status: "created",
  };

  await Promise.all([
    putLead(cfEnv.LEADS_KV, lead),
    notifyTeam(cfEnv, `New onboarding lead: ${basics.businessName}`, lead),
  ]);

  const priceIds: Record<Plan, Record<Billing, string | undefined>> = {
    base: { monthly: cfEnv.STRIPE_PRICE_MONTHLY, annual: cfEnv.STRIPE_PRICE_ANNUAL },
    premium: {
      monthly: cfEnv.STRIPE_PRICE_PREMIUM_MONTHLY,
      annual: cfEnv.STRIPE_PRICE_PREMIUM_ANNUAL,
    },
  };
  const { STRIPE_SECRET_KEY } = cfEnv;
  const priceId = priceIds[plan][billing];
  if (!STRIPE_SECRET_KEY || !priceId) {
    return Response.json({ error: "checkout not configured" }, { status: 501 });
  }

  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    customer_email: basics.email,
    success_url: `${origin}/onboarding/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/onboarding?plan=${plan}&billing=${billing}&cancelled=1`,
    "metadata[lead_id]": lead.id,
    "metadata[plan]": plan,
    "metadata[billing]": billing,
    "metadata[vertical]": basics.vertical,
    "metadata[business_name]": basics.businessName.slice(0, 500),
    "metadata[owner_name]": basics.ownerName.slice(0, 500),
    "metadata[business_phone]": basics.businessPhone,
    "subscription_data[metadata][lead_id]": lead.id,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) {
    return Response.json({ error: "failed to create checkout session" }, { status: 502 });
  }

  const session = (await res.json()) as { id?: string; url?: string };
  if (!session.url) {
    return Response.json({ error: "failed to create checkout session" }, { status: 502 });
  }

  if (session.id) {
    await putLead(cfEnv.LEADS_KV, { ...lead, stripeSessionId: session.id });
  }
  return Response.json({ url: session.url });
}

async function handleSetup(
  cfEnv: OnboardingEnv,
  sessionId: string,
  setup: SetupDetails,
): Promise<Response> {
  if (!cfEnv.STRIPE_SECRET_KEY) {
    return Response.json({ error: "checkout not configured" }, { status: 501 });
  }

  const session = await getCheckoutSession(cfEnv.STRIPE_SECRET_KEY, sessionId);
  if (!session) {
    return Response.json({ error: "unknown session" }, { status: 400 });
  }
  if (session.payment_status !== "paid") {
    return Response.json({ error: "session not paid" }, { status: 402 });
  }
  const leadId = session.metadata?.lead_id;
  if (!leadId) {
    return Response.json({ error: "unknown session" }, { status: 400 });
  }

  const existing = await getLead(cfEnv.LEADS_KV, leadId);
  const lead = existing ?? reconstructLead(leadId, session);
  const alreadyComplete = lead.status === "setup_complete";

  lead.setup = setup;
  lead.stripeSessionId = session.id;
  if (typeof session.customer === "string") lead.stripeCustomerId = session.customer;
  if (typeof session.subscription === "string") lead.stripeSubscriptionId = session.subscription;
  if (lead.status === "created") lead.paidAt = lead.paidAt ?? new Date().toISOString();
  if (!alreadyComplete) {
    lead.status = "setup_complete";
    lead.setupCompletedAt = new Date().toISOString();
  }

  await Promise.all([
    putLead(cfEnv.LEADS_KV, lead),
    alreadyComplete
      ? Promise.resolve()
      : notifyTeam(cfEnv, `Setup complete — ready to provision: ${lead.basics.businessName}`, lead),
  ]);

  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const cfEnv = env as unknown as OnboardingEnv;

  let body: OnboardingRequest;
  try {
    body = (await request.json()) as OnboardingRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { intent } = body;
  if (intent !== "checkout" && intent !== "call" && intent !== "setup") {
    return Response.json({ error: "invalid intent" }, { status: 400 });
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, ip && `ob:${intent}:${ip}`, RATE_LIMITS[intent])) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  if (intent === "call") {
    const error = validateCall(body.call);
    if (error) return Response.json({ error }, { status: 400 });
    const lead = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      intent,
      call: body.call,
    };
    await Promise.all([
      cfEnv.LEADS_KV?.put(`lead:${lead.id}`, JSON.stringify(lead)).catch(() => {}),
      notifyTeam(cfEnv, `New call request: ${body.call?.name ?? ""}`, lead),
    ]);
    return Response.json({ ok: true });
  }

  if (intent === "checkout") {
    const plan: Plan = body.plan ?? "base";
    if (!PLAN_OPTIONS.includes(plan)) {
      return Response.json({ error: "invalid plan" }, { status: 400 });
    }
    if (!BILLING_OPTIONS.includes(body.billing as Billing)) {
      return Response.json({ error: "invalid billing" }, { status: 400 });
    }
    const error = validateBasics(body.basics);
    if (error) return Response.json({ error }, { status: 400 });
    return handleCheckout(
      cfEnv,
      request,
      plan,
      body.billing as Billing,
      body.basics as BusinessBasics,
    );
  }

  if (!isShortString(body.sessionId, 300) || !SESSION_ID_RE.test(body.sessionId)) {
    return Response.json({ error: "invalid sessionId" }, { status: 400 });
  }
  const error = validateSetup(body.setup);
  if (error) return Response.json({ error }, { status: 400 });
  return handleSetup(cfEnv, body.sessionId, body.setup as SetupDetails);
}
