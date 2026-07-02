import { env } from "cloudflare:workers";
import { DAYS, EMAIL_RE, type OnboardingData, PHONE_RE, VERTICAL_IDS } from "@/lib/onboarding";
import { BILLING_OPTIONS, type Billing } from "@/lib/plans";

export const dynamic = "force-dynamic";

interface OnboardingEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
  LEADS_KV?: KVNamespace;
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
}

interface CallRequest {
  name: string;
  email: string;
  phone: string;
  preferredTime: string;
  question: string;
}

interface OnboardingRequest {
  intent: "checkout" | "call";
  billing: Billing;
  data: OnboardingData;
  call?: CallRequest;
}

const TIME_RE = /^\d{2}:\d{2}$/;

function isShortString(value: unknown, max = 120): value is string {
  return typeof value === "string" && value.length <= max;
}

function validate(body: OnboardingRequest): string | null {
  const { intent, billing, data, call } = body;
  if (intent !== "checkout" && intent !== "call") return "invalid intent";

  if (intent === "call") {
    if (typeof call !== "object" || call === null) return "invalid call";
    if (!isShortString(call.name) || !call.name.trim()) return "invalid name";
    if (!isShortString(call.email) || !EMAIL_RE.test(call.email)) return "invalid email";
    if (!isShortString(call.phone) || !PHONE_RE.test(call.phone)) return "invalid phone";
    if (!isShortString(call.preferredTime, 200)) return "invalid preferredTime";
    if (typeof call.question !== "string" || call.question.length > 2000) return "invalid question";
    return null;
  }

  if (!BILLING_OPTIONS.includes(billing)) return "invalid billing";
  if (typeof data !== "object" || data === null) return "invalid data";
  if (!isShortString(data.email) || !EMAIL_RE.test(data.email)) return "invalid email";
  if (!VERTICAL_IDS.includes(data.vertical)) return "invalid vertical";
  if (!isShortString(data.businessName) || !data.businessName.trim()) return "invalid businessName";
  if (!isShortString(data.ownerName) || !data.ownerName.trim()) return "invalid ownerName";
  for (const field of ["businessPhone", "ownerMobile", "forwardNumber"] as const) {
    if (!isShortString(data[field]) || !PHONE_RE.test(data[field])) return `invalid ${field}`;
  }
  if (!isShortString(data.timezone, 60)) return "invalid timezone";
  if (data.calendar !== "google_calendar" && data.calendar !== "none") return "invalid calendar";
  if (typeof data.notes !== "string" || data.notes.length > 2000) return "invalid notes";

  if (typeof data.hours !== "object" || data.hours === null) return "invalid hours";
  for (const day of DAYS) {
    const h = data.hours[day.id];
    if (typeof h?.closed !== "boolean" || !TIME_RE.test(h.open) || !TIME_RE.test(h.close))
      return "invalid hours";
    if (!h.closed && h.open >= h.close) return "invalid hours";
  }

  if (!Array.isArray(data.services) || data.services.length === 0 || data.services.length > 30)
    return "invalid services";
  const hasService = data.services.some(
    (s) => isShortString(s?.name) && s.name.trim() && Number(s?.durationMin) > 0,
  );
  if (
    !hasService ||
    !data.services.every(
      (s) =>
        isShortString(s?.name) && isShortString(s?.durationMin, 5) && isShortString(s?.price, 10),
    )
  )
    return "invalid services";

  if (
    !Array.isArray(data.staff) ||
    data.staff.length > 30 ||
    !data.staff.some((s) => isShortString(s) && s.trim()) ||
    !data.staff.every((s) => isShortString(s))
  )
    return "invalid staff";

  return null;
}

async function notifyTeam(
  { RESEND_API_KEY, LEAD_NOTIFY_EMAIL }: OnboardingEnv,
  subject: string,
  lead: Record<string, unknown>,
): Promise<void> {
  if (!RESEND_API_KEY || !LEAD_NOTIFY_EMAIL) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Kaijiro Leads <onboarding@resend.dev>",
      to: [LEAD_NOTIFY_EMAIL],
      subject,
      text: JSON.stringify(lead, null, 2),
    }),
  }).catch(() => {});
}

export async function POST(request: Request) {
  const cfEnv = env as unknown as OnboardingEnv;

  let body: OnboardingRequest;
  try {
    body = (await request.json()) as OnboardingRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const base = { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  const [lead, subject] =
    body.intent === "call"
      ? [
          { ...base, intent: body.intent, call: body.call },
          `New call request: ${body.call?.name ?? ""}`,
        ]
      : [
          { ...base, intent: body.intent, billing: body.billing, data: body.data },
          `New onboarding lead: ${body.data.businessName}`,
        ];

  await Promise.all([
    cfEnv.LEADS_KV?.put(`lead:${lead.id}`, JSON.stringify(lead)).catch(() => {}),
    notifyTeam(cfEnv, subject, lead),
  ]);

  if (body.intent === "call") {
    return Response.json({ ok: true });
  }

  const { STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL } = cfEnv;
  const priceId = body.billing === "annual" ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_MONTHLY;
  if (!STRIPE_SECRET_KEY || !priceId) {
    return Response.json({ error: "checkout not configured" }, { status: 501 });
  }

  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    customer_email: body.data.email,
    success_url: `${origin}/onboarding/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/onboarding?billing=${body.billing}&cancelled=1`,
    "metadata[lead_id]": lead.id,
    "metadata[vertical]": body.data.vertical,
    "metadata[business_name]": body.data.businessName.slice(0, 500),
    "metadata[owner_name]": body.data.ownerName.slice(0, 500),
    "metadata[business_phone]": body.data.businessPhone,
    "metadata[forward_number]": body.data.forwardNumber,
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

  const session = (await res.json()) as { url?: string };
  if (!session.url) {
    return Response.json({ error: "failed to create checkout session" }, { status: 502 });
  }
  return Response.json({ url: session.url });
}
