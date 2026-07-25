import { env } from "cloudflare:workers";
import { getLead, putLead } from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import { type Billing, extraLocationCount } from "@/lib/plans";
import { type PortalEnv, listAccountShops } from "@/lib/portalApi";
import { patchShop } from "@/lib/provisioning";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import {
  UPGRADABLE_STATUSES,
  findPlanItem,
  getSubscription,
  setSubscriptionExtraLocations,
  swapSubscriptionPrice,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface UpgradeEnv extends PortalEnv {
  STRIPE_PRICE_PREMIUM_MONTHLY?: string;
  STRIPE_PRICE_PREMIUM_ANNUAL?: string;
  STRIPE_PRICE_EXTRA_LOCATION_MONTHLY?: string;
  STRIPE_PRICE_EXTRA_LOCATION_ANNUAL?: string;
}

function back(request: Request, status: string): Response {
  const url = new URL("/portal/billing", request.url);
  url.searchParams.set("upgrade", status);
  return Response.redirect(url.toString(), 303);
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as UpgradeEnv;

  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);

  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `upgrade:${session.accountId}`, 10)) {
    return back(request, "failed");
  }

  // The subscription comes from the session's lead, never from the request — otherwise anyone
  // signed in could upgrade (and charge) someone else's subscription.
  const lead = session.leadId ? await getLead(cfEnv.LEADS_KV, session.leadId) : null;
  if (!cfEnv.STRIPE_SECRET_KEY || !lead?.stripeSubscriptionId) return back(request, "failed");
  if (lead.plan === "premium") return back(request, "already");

  const { STRIPE_PRICE_EXTRA_LOCATION_MONTHLY, STRIPE_PRICE_EXTRA_LOCATION_ANNUAL } = cfEnv;
  const extraPriceIds = new Set(
    [STRIPE_PRICE_EXTRA_LOCATION_MONTHLY, STRIPE_PRICE_EXTRA_LOCATION_ANNUAL].filter(
      (id): id is string => Boolean(id),
    ),
  );

  const subscription = await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId);
  const item = findPlanItem(subscription, extraPriceIds);
  if (!item || !UPGRADABLE_STATUSES.has(subscription?.status ?? "")) {
    return back(request, "failed");
  }

  // Stripe holds the truth about which cycle the client is on; the lead can have drifted.
  const billing: Billing = item.price?.recurring?.interval === "year" ? "annual" : "monthly";
  const priceId =
    billing === "annual" ? cfEnv.STRIPE_PRICE_PREMIUM_ANNUAL : cfEnv.STRIPE_PRICE_PREMIUM_MONTHLY;
  if (!priceId) return back(request, "failed");
  if (item.price?.id === priceId) return back(request, "already");

  const updated = await swapSubscriptionPrice(cfEnv.STRIPE_SECRET_KEY, {
    subscriptionId: lead.stripeSubscriptionId,
    itemId: item.id,
    priceId,
    plan: "premium",
  });
  if (!updated) return back(request, "failed");

  lead.plan = "premium";
  lead.billing = billing;
  await putLead(cfEnv.LEADS_KV, lead);

  // Premium's flat price already covers two salons, so an account paying an extra-location line for
  // its second one stops owing it the moment the plan changes. Re-derived absolutely, like add and
  // remove do — on a single-salon account the quantity is 0 and this makes no Stripe call at all.
  const activeSalons = (await listAccountShops(cfEnv, session.accountId)).filter(
    (s) => s.status !== "cancelled",
  ).length;
  const quantity = extraLocationCount("premium", activeSalons);
  const rebilled =
    STRIPE_PRICE_EXTRA_LOCATION_MONTHLY && STRIPE_PRICE_EXTRA_LOCATION_ANNUAL
      ? await setSubscriptionExtraLocations(cfEnv.STRIPE_SECRET_KEY, {
          subscription: updated,
          monthlyPriceId: STRIPE_PRICE_EXTRA_LOCATION_MONTHLY,
          annualPriceId: STRIPE_PRICE_EXTRA_LOCATION_ANNUAL,
          quantity,
        })
      : false;

  // Reminders are what Premium is bought for, so a failed PATCH is a paid-for feature that never
  // switched on — the client sees it, and the team gets told to fix the shop by hand.
  const remindersOn = session.shopId
    ? await patchShop(cfEnv, session.shopId, { reminders_enabled: true })
    : false;

  await notifyTeam(cfEnv, `⬆️ Upgraded to Premium — ${lead.basics.businessName}`, {
    leadId: lead.id,
    email: session.email,
    billing,
    subscription: lead.stripeSubscriptionId,
    reminders: remindersOn ? "enabled" : "FAILED — turn on reminders_enabled by hand",
    extraLocations: rebilled ? quantity : `FAILED — set the extra-location quantity to ${quantity}`,
  });

  return back(request, remindersOn && rebilled ? "done" : "partial");
}
