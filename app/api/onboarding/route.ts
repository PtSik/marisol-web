import { env } from "cloudflare:workers";
import { type Locale, parseLocale } from "@/lib/i18n/dict";
import {
  type CheckoutLead,
  activationNeedsReconciliation,
  checkoutRequestMatchesLead,
  getLead,
  getLeadIdForAccount,
  putLead,
  putLeadIdForAccount,
} from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import {
  type BusinessBasics,
  EMAIL_RE,
  PHONE_RE,
  type SetupDetails,
  VERTICAL_IDS,
  isTimezoneId,
  validateSetupPayload,
} from "@/lib/onboarding";
import {
  BILLING_OPTIONS,
  type Billing,
  PLAN_OPTIONS,
  type Plan,
  TRIAL_DAYS,
  normalizePlan,
} from "@/lib/plans";
import { listAccountShopsStrict } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { REF_CODE_RE, refCodeFromCookie } from "@/lib/referrals";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { APP_URL } from "@/lib/site";
import {
  type PlanPriceEnv,
  SESSION_ID_RE,
  checkoutSettled,
  expireCheckoutSession,
  findPromotionCode,
  getCheckoutSession,
  lookupCheckoutSession,
  planPriceId,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface OnboardingEnv extends PlanPriceEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_REFERRAL_COUPON?: string;
  LEADS_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
  RESEND_FROM?: string;
  CLIENT_EMAIL_FROM?: string;
  GCAL_SHARE_EMAIL?: string;
  VOICE_AGENT_API?: Fetcher;
  VOICE_AGENT_API_URL?: string;
  ADMIN_API_KEY?: string;
  GROOMING_AGENT_ID?: string;
  BARBER_AGENT_ID?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
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
  referralCode?: string;
  promoCode?: string;
  locale?: string;
}

const RATE_LIMITS: Record<OnboardingRequest["intent"], number> = {
  checkout: 10,
  call: 5,
  setup: 20,
};

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
  // US-only, and the same list the portal offers — a shop that gets a zone the portal can't render
  // is a shop whose owner can never save its setup again.
  if (!isTimezoneId(b.timezone)) return "invalid timezone";
  return null;
}

interface ResolvedCode {
  code: string;
  promoId: string;
  isReferral: boolean;
}

// Codes reach checkout from three places: the promo field, the referral field, and the ?ref= cookie.
// Only a referrer's own code carries an account_id, and only that one earns a payout — a campaign
// code (HIALEAH20 and friends) belongs to nobody. Stripe takes one code per session, so the two
// roles are resolved separately: the client keeps the bigger campaign discount while the friend who
// sent them still gets credited.
async function resolveCodes(
  cfEnv: OnboardingEnv,
  request: Request,
  typed: { promo?: string; referral?: string },
): Promise<{ discount: ResolvedCode | null; attribution: ResolvedCode | null }> {
  const none = { discount: null, attribution: null };
  if (!cfEnv.STRIPE_SECRET_KEY) return none;

  const candidates = [
    typed.promo?.trim().toUpperCase(),
    typed.referral?.trim().toUpperCase(),
    refCodeFromCookie(request),
  ].filter((code): code is string => Boolean(code) && REF_CODE_RE.test(code as string));
  const unique = [...new Set(candidates)];
  if (unique.length === 0) return none;

  const resolved: ResolvedCode[] = [];
  for (const code of unique) {
    const promo = await findPromotionCode(cfEnv.STRIPE_SECRET_KEY, code);
    if (promo) {
      resolved.push({ code, promoId: promo.id, isReferral: Boolean(promo.metadata?.account_id) });
    }
  }

  return {
    // Field order decides the discount, so a client who typed only a friend's code still gets 10%.
    discount: resolved[0] ?? null,
    attribution: resolved.find((r) => r.isReferral) ?? null,
  };
}

async function handleCheckout(
  cfEnv: OnboardingEnv,
  request: Request,
  plan: Plan,
  billing: Billing,
  basics: BusinessBasics,
  accountId: string,
  codes: { promo?: string; referral?: string },
  locale: Locale,
): Promise<Response> {
  // One subscription per account. A client whose provisioning failed still lands back in the wizard
  // (there is no salon to show them), and without this they could buy a second subscription while
  // the team is fixing the first by hand. A lead still at "created" is an abandoned checkout — that
  // one has to stay retryable. Extra salons are a line item on the existing subscription, not this.
  const existingLeadId = await getLeadIdForAccount(cfEnv.LEADS_KV, accountId);
  const existingLead = existingLeadId ? await getLead(cfEnv.LEADS_KV, existingLeadId) : null;
  if (existingLead && existingLead.status !== "created" && existingLead.status !== "cancelled") {
    return Response.json(
      { error: "this account already has a subscription", sessionId: existingLead.stripeSessionId },
      { status: 409 },
    );
  }

  const { STRIPE_SECRET_KEY } = cfEnv;
  const priceId = planPriceId(cfEnv, plan, billing);
  if (!STRIPE_SECRET_KEY || !priceId) {
    return Response.json({ error: "checkout not configured" }, { status: 501 });
  }

  const { discount, attribution } = await resolveCodes(cfEnv, request, codes);
  let checkoutAttempt = existingLead?.checkoutAttempt ?? 1;
  if (existingLead?.status === "created" && existingLead.stripeSessionId) {
    const lookup = await lookupCheckoutSession(STRIPE_SECRET_KEY, existingLead.stripeSessionId);
    if (lookup.kind === "unavailable") {
      return Response.json({ error: "could not verify previous checkout" }, { status: 503 });
    }
    if (lookup.kind === "missing") {
      // A stale id from another Stripe mode/key can never become payable in this environment.
      // Move the idempotency key forward and replace it instead of trapping the account forever.
      checkoutAttempt += 1;
    } else if (lookup.session.status === "complete") {
      return Response.json(
        { error: "this account already has a subscription", sessionId: lookup.session.id },
        { status: 409 },
      );
    } else if (lookup.session.status === "open") {
      const reusable =
        Boolean(lookup.session.url) &&
        checkoutRequestMatchesLead(existingLead, {
          plan,
          billing,
          locale,
          basics,
          promotionId: discount?.promoId,
          referralCode: attribution?.code,
        });
      if (reusable) return Response.json({ url: lookup.session.url });

      // The customer changed a price-, discount- or business-defining input. The old Checkout must
      // stop being payable before a replacement is created, otherwise both links can subscribe.
      if (!(await expireCheckoutSession(STRIPE_SECRET_KEY, existingLead.stripeSessionId))) {
        return Response.json({ error: "could not replace previous checkout" }, { status: 503 });
      }
      checkoutAttempt += 1;
    } else if (lookup.session.status === "expired") {
      checkoutAttempt += 1;
    } else {
      return Response.json({ error: "previous checkout is not reusable" }, { status: 409 });
    }
  }
  // Backstop for accounts that subscribed before the index above existed: a live salon means the
  // subscription is already running, and a second one belongs on it as an extra location.
  const owned = await listAccountShopsStrict(cfEnv, accountId);
  if (!owned) {
    return Response.json({ error: "could not verify existing salons" }, { status: 503 });
  }
  if (owned.some((s) => s.status !== "cancelled")) {
    return Response.json({ error: "this account already has a salon" }, { status: 409 });
  }

  const lead: CheckoutLead = {
    ...(existingLead?.status === "created" ? existingLead : {}),
    id: existingLead?.status === "created" ? existingLead.id : crypto.randomUUID(),
    createdAt:
      existingLead?.status === "created" ? existingLead.createdAt : new Date().toISOString(),
    intent: "checkout",
    plan,
    billing,
    locale,
    basics,
    status: "created",
    accountId,
    checkoutAttempt,
    checkoutReuseVersion: 1,
    checkoutPromotionId: discount?.promoId,
    checkoutReferralCode: attribution?.code,
    // An expired session must not survive into the durable retry record. If Stripe creates the new
    // session but our response or final KV write is lost, the next request reuses this same attempt
    // number/idempotency key instead of creating another subscription-capable session.
    stripeSessionId: undefined,
  };

  await Promise.all([
    putLead(cfEnv.LEADS_KV, lead),
    putLeadIdForAccount(cfEnv.LEADS_KV, accountId, lead.id),
    notifyTeam(cfEnv, `New onboarding lead: ${basics.businessName}`, lead),
  ]);

  const origin = new URL(request.url).origin;
  const langQuery = locale === "es" ? "&lang=es" : "";
  const params = new URLSearchParams({
    mode: "subscription",
    locale,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    customer_email: basics.email,
    success_url: `${APP_URL}/onboarding/thanks?session_id={CHECKOUT_SESSION_ID}${langQuery}`,
    cancel_url: `${origin}/onboarding?plan=${plan}&billing=${billing}&cancelled=1${langQuery}`,
    "metadata[lead_id]": lead.id,
    "metadata[account_id]": accountId,
    "metadata[locale]": locale,
    "metadata[plan]": plan,
    "metadata[billing]": billing,
    "metadata[vertical]": basics.vertical,
    "metadata[business_name]": basics.businessName.slice(0, 500),
    "metadata[owner_name]": basics.ownerName.slice(0, 500),
    "metadata[business_phone]": basics.businessPhone,
    "subscription_data[metadata][lead_id]": lead.id,
    "subscription_data[metadata][account_id]": accountId,
    "subscription_data[trial_period_days]": String(TRIAL_DAYS),
  });

  if (discount) params.set("discounts[0][promotion_code]", discount.promoId);
  if (attribution) params.set("metadata[referral_code]", attribution.code);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `checkout:${lead.id}:${checkoutAttempt}`,
    },
    body: params,
  });
  if (!res.ok) {
    // A campaign code is tied to one product (HIALEAH20 and friends only discount Complete), and
    // Stripe refuses the whole session when the code matches nothing in the order. Forwarded as its
    // own machine code, because "please try again" for a rule a retry cannot satisfy just sends the
    // owner round the same loop — the same reason setup errors are translated in lib/i18n/dict.ts.
    const failure = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    if (failure?.error?.code === "coupon_applies_to_nothing") {
      return Response.json({ error: "promo not applicable" }, { status: 400 });
    }
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
  accountId: string,
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
  // Knowing a cs_… id is not authorisation to drive someone else's setup. Checkouts from before
  // account-first onboarding carry no account_id — those keep working for any signed-in client
  // rather than locking their own owner out.
  const checkoutAccountId = session.metadata?.account_id;
  if (checkoutAccountId && checkoutAccountId !== accountId) {
    return Response.json({ error: "not your checkout" }, { status: 403 });
  }
  if (!checkoutSettled(session)) {
    return Response.json({ error: "session not paid" }, { status: 402 });
  }
  const leadId = session.metadata?.lead_id;
  if (!leadId) {
    return Response.json({ error: "unknown session" }, { status: 400 });
  }

  const lead = await getLead(cfEnv.LEADS_KV, leadId);
  // Stripe metadata intentionally does not carry owner mobile, time zone or the complete setup.
  // Reconstructing a missing KV record used to turn a transient read failure into a live but broken
  // receptionist. Assisted launch fails closed and lets the client retry instead.
  if (!lead) {
    return Response.json({ error: "setup temporarily unavailable" }, { status: 503 });
  }

  if (lead.status === "provisioned") {
    lead.setup = setup;
    await putLead(cfEnv.LEADS_KV, lead);
    return Response.json({ ok: true, provisioned: true, number: lead.assignedNumber });
  }

  if (lead.status === "activating") {
    return Response.json({ ok: true, pendingReview: true });
  }
  if (lead.status === "cancelled" || lead.status === "cancellation_pending") {
    return Response.json({ error: "subscription cancelled" }, { status: 409 });
  }
  if (lead.status === "activation_failed" && activationNeedsReconciliation(lead)) {
    return Response.json({ error: "activation needs reconciliation" }, { status: 409 });
  }

  const shouldNotify = lead.status !== "pending_review";
  lead.setup = setup;
  lead.stripeSessionId = session.id;
  if (typeof session.customer === "string") lead.stripeCustomerId = session.customer;
  if (typeof session.subscription === "string") lead.stripeSubscriptionId = session.subscription;
  if (lead.status === "created") lead.paidAt = lead.paidAt ?? new Date().toISOString();
  lead.status = "pending_review";
  lead.setupCompletedAt = lead.setupCompletedAt ?? new Date().toISOString();
  lead.activationFailedAt = undefined;
  lead.provisionError = undefined;

  await putLead(cfEnv.LEADS_KV, lead);
  if (shouldNotify) {
    await notifyTeam(cfEnv, `🔎 Setup ready for review: ${lead.basics.businessName}`, lead);
  }

  return Response.json({ ok: true, pendingReview: true });
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
    const plan: Plan = body.plan ?? "basic";
    if (!PLAN_OPTIONS.includes(plan)) {
      return Response.json({ error: "invalid plan" }, { status: 400 });
    }
    if (!BILLING_OPTIONS.includes(body.billing as Billing)) {
      return Response.json({ error: "invalid billing" }, { status: 400 });
    }
    // First-salon checkout requires an existing portal login — the account already exists, so
    // guest checkout and the post-payment Google gate both go away.
    const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
    if (!session) return Response.json({ error: "not signed in" }, { status: 401 });
    const basics: BusinessBasics = { ...(body.basics as BusinessBasics), email: session.email };
    const error = validateBasics(basics);
    if (error) return Response.json({ error }, { status: 400 });
    return handleCheckout(
      cfEnv,
      request,
      plan,
      body.billing as Billing,
      basics,
      session.accountId,
      {
        promo: typeof body.promoCode === "string" ? body.promoCode : undefined,
        referral: typeof body.referralCode === "string" ? body.referralCode : undefined,
      },
      parseLocale(body.locale),
    );
  }

  if (!isShortString(body.sessionId, 300) || !SESSION_ID_RE.test(body.sessionId)) {
    return Response.json({ error: "invalid sessionId" }, { status: 400 });
  }
  const setupSession = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!setupSession) return Response.json({ error: "not signed in" }, { status: 401 });
  const error = validateSetupPayload(body.setup);
  if (error) return Response.json({ error }, { status: 400 });
  return handleSetup(cfEnv, setupSession.accountId, body.sessionId, body.setup as SetupDetails);
}
