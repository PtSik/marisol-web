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
import { type Billing, canAddLocation, extraLocationCount, normalizePlan } from "@/lib/plans";
import { type PortalEnv, listAccountShops } from "@/lib/portalApi";
import { provisionLead } from "@/lib/provisioning";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { UPGRADABLE_STATUSES, getSubscription, setSubscriptionExtraLocations } from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface AddSalonEnv extends PortalEnv {
  STRIPE_PRICE_EXTRA_LOCATION_MONTHLY?: string;
  STRIPE_PRICE_EXTRA_LOCATION_ANNUAL?: string;
  GROOMING_AGENT_ID?: string;
  BARBER_AGENT_ID?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  STRIPE_REFERRAL_COUPON?: string;
}

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
    status: "paid",
    additionalLocation: true,
    accountId: session.accountId,
    stripeCustomerId: primary.stripeCustomerId,
    stripeSubscriptionId: primary.stripeSubscriptionId,
    paidAt: now,
    setup: body.setup as SetupDetails,
    setupCompletedAt: now,
  };
  await putLead(cfEnv.LEADS_KV, lead);

  // Provision before charging: a location we couldn't stand up (no US number in the area code)
  // must not leave the owner paying for a dead line. The charge only lands once the salon is live.
  const result = await provisionLead(cfEnv, lead);
  if (!result.ok) {
    lead.provisionError = result.reason;
    await putLead(cfEnv.LEADS_KV, lead);
    return Response.json({ error: "could not provision", reason: result.reason }, { status: 502 });
  }

  lead.status = "provisioned";
  lead.shopId = result.shopId;
  lead.assignedNumber = result.number;
  lead.provisionedAt = new Date().toISOString();
  await putLead(cfEnv.LEADS_KV, lead);

  // Bill the extra locations by an absolute count: re-derive how many of the account's live salons
  // sit past the plan limit and set the line item to that, prorated. Self-correcting on retries.
  const activeSalons = (await listAccountShops(cfEnv, session.accountId)).filter(
    (s) => s.status !== "cancelled",
  ).length;
  const quantity = extraLocationCount(plan, activeSalons);
  const { STRIPE_PRICE_EXTRA_LOCATION_MONTHLY, STRIPE_PRICE_EXTRA_LOCATION_ANNUAL } = cfEnv;
  const billed =
    STRIPE_PRICE_EXTRA_LOCATION_MONTHLY && STRIPE_PRICE_EXTRA_LOCATION_ANNUAL
      ? await setSubscriptionExtraLocations(cfEnv.STRIPE_SECRET_KEY, {
          subscription,
          monthlyPriceId: STRIPE_PRICE_EXTRA_LOCATION_MONTHLY,
          annualPriceId: STRIPE_PRICE_EXTRA_LOCATION_ANNUAL,
          quantity,
        })
      : false;

  // The salon is live; a failed charge is a back-office fix, not a reason to tear down a working
  // receptionist. Tell the team so billing gets reconciled by hand.
  if (!billed) {
    await notifyTeam(cfEnv, `💳 Extra-location charge failed — ${basics.businessName}`, {
      accountId: session.accountId,
      shopId: result.shopId,
      subscription: primary.stripeSubscriptionId,
      quantity,
    });
  }

  return Response.json({ ok: true, number: result.number, billed });
}
