import { env } from "cloudflare:workers";
import { getLead } from "@/lib/leads";
import { portalAccessRedirect } from "@/lib/portalAccess";
import type { PortalEnv } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { getSubscription, scheduleSubscriptionCancellation } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function back(request: Request, result: string): Response {
  const url = new URL("/portal/billing", request.url);
  url.searchParams.set("cancel", result);
  return Response.redirect(url.toString(), 303);
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;
  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);
  if (await portalAccessRedirect(cfEnv, session, { allowPending: true })) {
    return Response.json({ error: "account is unavailable" }, { status: 403 });
  }
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `cancel:${session.accountId}`, 5)) {
    return back(request, "failed");
  }
  const lead = session.leadId ? await getLead(cfEnv.LEADS_KV, session.leadId) : null;
  if (!cfEnv.STRIPE_SECRET_KEY || !lead?.stripeSubscriptionId) return back(request, "failed");

  const current = await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId);
  if (!current || (current.metadata?.lead_id && current.metadata.lead_id !== lead.id)) {
    return back(request, "failed");
  }
  if (current.cancel_at_period_end) return back(request, "already");
  const cancelled = await scheduleSubscriptionCancellation(
    cfEnv.STRIPE_SECRET_KEY,
    lead.stripeSubscriptionId,
  );
  return back(request, cancelled?.cancel_at_period_end ? "scheduled" : "failed");
}
