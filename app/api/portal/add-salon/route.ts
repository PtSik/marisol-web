import { env } from "cloudflare:workers";
import { type CheckoutLead, getLead, putLead } from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import {
  type BusinessBasics,
  PHONE_RE,
  type SetupDetails,
  TIMEZONE_IDS,
  VERTICAL_IDS,
  type Vertical,
  validateSetupPayload,
} from "@/lib/onboarding";
import { type Billing, canAddLocation, normalizePlan } from "@/lib/plans";
import { portalAccessRedirect } from "@/lib/portalAccess";
import type { PortalEnv } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { UPGRADABLE_STATUSES, getSubscription } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type AddSalonEnv = PortalEnv;

interface AddSalonRequest {
  businessName?: string;
  businessPhone?: string;
  timezone?: string;
  vertical?: string;
  setup?: SetupDetails;
}

function isShortString(value: unknown, max = 120): value is string {
  return typeof value === "string" && value.length <= max;
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as AddSalonEnv;

  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.json({ error: "not signed in" }, { status: 401 });
  if (await portalAccessRedirect(cfEnv, session)) {
    return Response.json({ error: "service is not active" }, { status: 403 });
  }

  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `add-salon:${session.accountId}`, 10)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let body: AddSalonRequest;
  try {
    body = (await request.json()) as AddSalonRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!isShortString(body.businessName) || !body.businessName.trim()) {
    return Response.json({ error: "invalid businessName" }, { status: 400 });
  }
  if (!isShortString(body.businessPhone) || !PHONE_RE.test(body.businessPhone)) {
    return Response.json({ error: "invalid businessPhone" }, { status: 400 });
  }
  if (!isShortString(body.timezone, 60) || !TIMEZONE_IDS.some((id) => id === body.timezone)) {
    return Response.json({ error: "invalid timezone" }, { status: 400 });
  }
  if (!VERTICAL_IDS.includes(body.vertical as Vertical)) {
    return Response.json({ error: "invalid vertical" }, { status: 400 });
  }
  const setupError = validateSetupPayload(body.setup);
  if (setupError) return Response.json({ error: setupError }, { status: 400 });

  // The account's first lead carries the shared subscription and the owner's details, which a new
  // location inherits — the shortened wizard only asks for what differs between salons.
  const primary = session.leadId ? await getLead(cfEnv.LEADS_KV, session.leadId) : null;
  if (!cfEnv.STRIPE_SECRET_KEY || !primary?.stripeSubscriptionId) {
    return Response.json({ error: "no active subscription" }, { status: 409 });
  }
  const subscription = await getSubscription(cfEnv.STRIPE_SECRET_KEY, primary.stripeSubscriptionId);
  if (!subscription || !UPGRADABLE_STATUSES.has(subscription.status ?? "")) {
    return Response.json({ error: "subscription not billable" }, { status: 409 });
  }

  const plan = normalizePlan(primary.plan);
  if (!canAddLocation(plan)) {
    return Response.json({ error: "upgrade required" }, { status: 409 });
  }
  const billing: Billing =
    subscription.items?.data?.[0]?.price?.recurring?.interval === "year" ? "annual" : "monthly";

  const basics: BusinessBasics = {
    vertical: body.vertical as Vertical,
    businessName: body.businessName.trim(),
    ownerName: primary.basics.ownerName,
    email: primary.basics.email,
    businessPhone: body.businessPhone,
    ownerMobile: primary.basics.ownerMobile,
    timezone: body.timezone,
  };

  const now = new Date().toISOString();
  const lead: CheckoutLead = {
    id: crypto.randomUUID(),
    createdAt: now,
    intent: "checkout",
    plan,
    billing,
    locale: primary.locale,
    basics,
    status: "pending_review",
    additionalLocation: true,
    accountId: session.accountId,
    stripeCustomerId: primary.stripeCustomerId,
    stripeSubscriptionId: primary.stripeSubscriptionId,
    paidAt: now,
    setup: body.setup as SetupDetails,
    setupCompletedAt: now,
  };
  await putLead(cfEnv.LEADS_KV, lead);
  await notifyTeam(cfEnv, `ADDITIONAL LOCATION — review setup: ${basics.businessName}`, lead);

  // Additional locations follow the same assisted-launch gate as a first salon. Provisioning and
  // any prorated location charge happen only after an admin has reviewed this exact setup.
  return Response.json({ ok: true, pendingReview: true });
}
