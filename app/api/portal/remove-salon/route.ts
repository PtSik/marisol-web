import { env } from "cloudflare:workers";
import { getLead, getLeadIdForShop, putLead } from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import { extraLocationCount, normalizePlan } from "@/lib/plans";
import { type PortalEnv, listAccountShopsStrict } from "@/lib/portalApi";
import { deprovisionLead, deprovisionShop } from "@/lib/provisioning";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { getSubscription, setSubscriptionExtraLocations } from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface RemoveSalonEnv extends PortalEnv {
  STRIPE_PRICE_EXTRA_LOCATION_MONTHLY?: string;
  STRIPE_PRICE_EXTRA_LOCATION_ANNUAL?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
}

function back(request: Request, status: string): Response {
  const url = new URL("/portal/salons", request.url);
  url.searchParams.set("removed", status);
  return Response.redirect(url.toString(), 303);
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as RemoveSalonEnv;

  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);

  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `remove-salon:${session.accountId}`, 10)) {
    return back(request, "failed");
  }

  const form = await request.formData();
  const target = String(form.get("shop_id") ?? "");

  const owned = await listAccountShopsStrict(cfEnv, session.accountId);
  if (!owned) return back(request, "failed");
  const shop = owned.find((s) => s.id === target);
  // Only a salon the account owns, never its primary one (that's the account's anchor and its
  // whole subscription — cancelling everything is a different, deliberate flow), and never the last
  // one standing.
  if (!shop || target === session.shopId) {
    return Response.json({ error: "not a removable salon" }, { status: 403 });
  }
  const activeBefore = owned.filter((s) => s.status !== "cancelled").length;
  if (activeBefore <= 1) return back(request, "failed");

  // Release the number and suspend the shop through the salon's own lead when we have it, so the
  // number and the cancelled status move together the same way deprovision-on-cancel does.
  const leadId = await getLeadIdForShop(cfEnv.LEADS_KV, target);
  const lead = leadId ? await getLead(cfEnv.LEADS_KV, leadId) : null;
  let deprovisioned = false;
  if (lead) {
    const result = await deprovisionLead(cfEnv, lead);
    deprovisioned = result.complete;
    lead.status = result.complete ? "cancelled" : "cancellation_pending";
    if (result.complete) lead.deprovisionedAt = new Date().toISOString();
    else lead.cancellationPendingAt = lead.cancellationPendingAt ?? new Date().toISOString();
    await putLead(cfEnv.LEADS_KV, lead);
  } else {
    deprovisioned = (await deprovisionShop(cfEnv, target, shop.twilio_number)).complete;
  }
  if (!deprovisioned) return back(request, "failed");

  // Drop the extra-location count by re-deriving it from what's left, prorated back to the client.
  const primary = session.leadId ? await getLead(cfEnv.LEADS_KV, session.leadId) : null;
  const { STRIPE_PRICE_EXTRA_LOCATION_MONTHLY, STRIPE_PRICE_EXTRA_LOCATION_ANNUAL } = cfEnv;
  if (
    cfEnv.STRIPE_SECRET_KEY &&
    primary?.stripeSubscriptionId &&
    STRIPE_PRICE_EXTRA_LOCATION_MONTHLY &&
    STRIPE_PRICE_EXTRA_LOCATION_ANNUAL
  ) {
    const subscription = await getSubscription(
      cfEnv.STRIPE_SECRET_KEY,
      primary.stripeSubscriptionId,
    );
    // Re-derive from what's actually left rather than assuming activeBefore-1, so a concurrent
    // add or remove can't drift the extra-location quantity off the real salon count.
    const remainingShops = await listAccountShopsStrict(cfEnv, session.accountId);
    const remaining = remainingShops?.filter((s) => s.status !== "cancelled").length;
    const quantity =
      remaining === undefined
        ? undefined
        : extraLocationCount(normalizePlan(primary.plan), remaining);
    const billed =
      subscription && quantity !== undefined
        ? await setSubscriptionExtraLocations(cfEnv.STRIPE_SECRET_KEY, {
            subscription,
            monthlyPriceId: STRIPE_PRICE_EXTRA_LOCATION_MONTHLY,
            annualPriceId: STRIPE_PRICE_EXTRA_LOCATION_ANNUAL,
            quantity,
          })
        : false;
    if (!billed) {
      await notifyTeam(cfEnv, `💳 Extra-location decrement failed — ${shop.name ?? target}`, {
        accountId: session.accountId,
        shopId: target,
        subscription: primary.stripeSubscriptionId,
        quantity: quantity ?? "unknown — shop listing failed",
      });
    }
  }

  return back(request, "done");
}
