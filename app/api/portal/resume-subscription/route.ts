import { env } from "cloudflare:workers";
import { getLead, getLeadIdForAccount } from "@/lib/leads";
import { portalAccessRedirect } from "@/lib/portalAccess";
import type { PortalEnv } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { getSubscription, resumeSubscription } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function back(request: Request, result: string): Response {
  const url = new URL("/portal/billing", request.url);
  url.searchParams.set("resume", result);
  return Response.redirect(url.toString(), 303);
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;
  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);
  if (await portalAccessRedirect(cfEnv, session, { allowPending: true })) {
    return Response.json({ error: "account is unavailable" }, { status: 403 });
  }
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `resume:${session.accountId}`, 5)) {
    return back(request, "failed");
  }
  const leadId = session.leadId ?? (await getLeadIdForAccount(cfEnv.LEADS_KV, session.accountId));
  const lead = leadId ? await getLead(cfEnv.LEADS_KV, leadId) : null;
  if (!cfEnv.STRIPE_SECRET_KEY || !lead?.stripeSubscriptionId) return back(request, "failed");
  const current = await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId);
  if (!current || (current.metadata?.lead_id && current.metadata.lead_id !== lead.id)) {
    return back(request, "failed");
  }
  if (!current.cancel_at_period_end) return back(request, "already");
  const resumed = await resumeSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId);
  return back(request, resumed && !resumed.cancel_at_period_end ? "done" : "failed");
}
