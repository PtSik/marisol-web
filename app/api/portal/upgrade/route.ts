import { env } from "cloudflare:workers";
import { getLead, getLeadIdForAccount, putLead } from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import {
  type Billing,
  PLAN_LABELS,
  PLAN_OPTIONS,
  type Plan,
  extraLocationCount,
  isUpgrade,
  normalizePlan,
} from "@/lib/plans";
import { portalAccessRedirect } from "@/lib/portalAccess";
import { type PortalEnv, listAccountShopsStrict } from "@/lib/portalApi";
import { patchShop } from "@/lib/provisioning";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import {
  type PlanPriceEnv,
  UPGRADABLE_STATUSES,
  findPlanItem,
  getSubscription,
  planPriceId,
  setSubscriptionExtraLocations,
  swapSubscriptionPrice,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface UpgradeEnv extends PortalEnv, PlanPriceEnv {
  STRIPE_PRICE_EXTRA_LOCATION_MONTHLY?: string;
  STRIPE_PRICE_EXTRA_LOCATION_ANNUAL?: string;
}

function back(request: Request, status: string): Response {
  const url = new URL("/portal/billing", request.url);
  url.searchParams.set("upgrade", status);
  return Response.redirect(url.toString(), 303);
}

async function requestedPlan(request: Request): Promise<Plan | null> {
  const form = await request.formData().catch(() => null);
  const raw = form?.get("plan");
  if (typeof raw !== "string") return null;
  return PLAN_OPTIONS.find((plan) => plan === raw) ?? null;
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as UpgradeEnv;

  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);
  if (await portalAccessRedirect(cfEnv, session)) {
    return Response.json({ error: "service is not active" }, { status: 403 });
  }

  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `upgrade:${session.accountId}`, 10)) {
    return back(request, "failed");
  }

  const target = await requestedPlan(request);
  if (!target) return back(request, "failed");

  // The subscription comes from the session's lead, never from the request — otherwise anyone
  // signed in could upgrade (and charge) someone else's subscription.
  const leadId = session.leadId ?? (await getLeadIdForAccount(cfEnv.LEADS_KV, session.accountId));
  const lead = leadId ? await getLead(cfEnv.LEADS_KV, leadId) : null;
  if (!cfEnv.STRIPE_SECRET_KEY || !lead?.stripeSubscriptionId) return back(request, "failed");

  const current = normalizePlan(lead.plan);
  if (current === target) return back(request, "already");
  const { STRIPE_PRICE_EXTRA_LOCATION_MONTHLY, STRIPE_PRICE_EXTRA_LOCATION_ANNUAL } = cfEnv;
  const extraPriceIds = new Set(
    [STRIPE_PRICE_EXTRA_LOCATION_MONTHLY, STRIPE_PRICE_EXTRA_LOCATION_ANNUAL].filter(
      (id): id is string => Boolean(id),
    ),
  );

  const subscription = await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId);
  const item = findPlanItem(subscription, extraPriceIds);
  if (
    !item ||
    !UPGRADABLE_STATUSES.has(subscription?.status ?? "") ||
    subscription?.cancel_at_period_end
  ) {
    return back(request, "failed");
  }
  const listedShops = await listAccountShopsStrict(cfEnv, session.accountId);
  if (!listedShops) return back(request, "failed");
  const activeShops = listedShops.filter((shop) => shop.status !== "cancelled");
  if (activeShops.length === 0 || (target === "basic" && activeShops.length > 1)) {
    return back(request, "failed");
  }

  // Stripe holds the truth about which cycle the client is on; the lead can have drifted.
  const billing: Billing = item.price?.recurring?.interval === "year" ? "annual" : "monthly";
  const priceId = planPriceId(cfEnv, target, billing);
  if (!priceId) return back(request, "failed");
  if (item.price?.id === priceId) return back(request, "already");

  const updated = await swapSubscriptionPrice(cfEnv.STRIPE_SECRET_KEY, {
    subscriptionId: lead.stripeSubscriptionId,
    itemId: item.id,
    priceId,
    plan: target,
  });
  if (!updated) return back(request, "failed");

  lead.plan = target;
  lead.billing = billing;
  await putLead(cfEnv.LEADS_KV, lead);

  // Re-derived absolutely, like add and remove do — every plan covers one salon, so this is a no-op
  // on a single-salon account and keeps the quantity honest on a multi-salon one.
  const quantity = extraLocationCount(target, activeShops.length);
  const rebilled =
    STRIPE_PRICE_EXTRA_LOCATION_MONTHLY && STRIPE_PRICE_EXTRA_LOCATION_ANNUAL
      ? await setSubscriptionExtraLocations(cfEnv.STRIPE_SECRET_KEY, {
          subscription: updated,
          monthlyPriceId: STRIPE_PRICE_EXTRA_LOCATION_MONTHLY,
          annualPriceId: STRIPE_PRICE_EXTRA_LOCATION_ANNUAL,
          quantity,
        })
      : false;

  // Reminders are what the paid tiers are bought for, so a failed PATCH is a paid-for feature that
  // never switched on — the client sees it, and the team gets told to fix the shop by hand.
  const remindersEnabled = target !== "basic";
  const reminderUpdates = await Promise.all(
    activeShops.map((shop) => patchShop(cfEnv, shop.id, { reminders_enabled: remindersEnabled })),
  );
  const remindersUpdated = reminderUpdates.length > 0 && reminderUpdates.every(Boolean);

  await notifyTeam(
    cfEnv,
    `${isUpgrade(current, target) ? "⬆️" : "⬇️"} Plan changed to ${PLAN_LABELS[target]} — ${lead.basics.businessName}`,
    {
      leadId: lead.id,
      email: session.email,
      plan: target,
      billing,
      subscription: lead.stripeSubscriptionId,
      reminders: remindersUpdated
        ? remindersEnabled
          ? "enabled"
          : "disabled"
        : `FAILED — set reminders_enabled=${remindersEnabled} by hand`,
      extraLocations: rebilled
        ? quantity
        : `FAILED — set the extra-location quantity to ${quantity}`,
    },
  );

  return back(request, remindersUpdated && rebilled ? "done" : "partial");
}
