import { env } from "cloudflare:workers";
import { getLead, getLeadIdForAccount } from "@/lib/leads";
import { portalAccessRedirect } from "@/lib/portalAccess";
import type { PortalEnv } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { redirectWithParam } from "@/lib/redirect";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import {
  getSubscription,
  resumeSubscription,
  scheduleSubscriptionCancellation,
} from "@/lib/stripe";

// Cancel and resume are one switch — Stripe's cancel_at_period_end — flipped from the billing page,
// so they share every guard and differ only in the direction and the outcome they report.
export async function changeScheduledCancellation(
  request: Request,
  action: "cancel" | "resume",
): Promise<Response> {
  const back = (result: string) => redirectWithParam(request, "/portal/billing", action, result);
  const cfEnv = env as unknown as PortalEnv;
  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);
  if (await portalAccessRedirect(cfEnv, session, { allowPending: true })) {
    return Response.json({ error: "account is unavailable" }, { status: 403 });
  }
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `${action}:${session.accountId}`, 5)) {
    return back("failed");
  }
  const leadId = session.leadId ?? (await getLeadIdForAccount(cfEnv.LEADS_KV, session.accountId));
  const lead = leadId ? await getLead(cfEnv.LEADS_KV, leadId) : null;
  if (!cfEnv.STRIPE_SECRET_KEY || !lead?.stripeSubscriptionId) return back("failed");

  const current = await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId);
  if (!current || (current.metadata?.lead_id && current.metadata.lead_id !== lead.id)) {
    return back("failed");
  }
  const cancel = action === "cancel";
  if (Boolean(current.cancel_at_period_end) === cancel) return back("already");
  const updated = cancel
    ? await scheduleSubscriptionCancellation(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId)
    : await resumeSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId);
  if (!updated || Boolean(updated.cancel_at_period_end) !== cancel) return back("failed");
  return back(cancel ? "scheduled" : "done");
}
