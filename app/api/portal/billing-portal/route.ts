import { env } from "cloudflare:workers";
import { getLead } from "@/lib/leads";
import type { PortalEnv } from "@/lib/portalApi";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { CUSTOMER_PORTAL_URL } from "@/lib/site";
import { createBillingPortalSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;

  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);

  const lead = session.leadId ? await getLead(cfEnv.LEADS_KV, session.leadId) : null;
  const url =
    cfEnv.STRIPE_SECRET_KEY && lead?.stripeCustomerId
      ? await createBillingPortalSession(
          cfEnv.STRIPE_SECRET_KEY,
          lead.stripeCustomerId,
          new URL("/portal/billing", request.url).toString(),
        )
      : null;

  // The no-code portal login page asks for an email instead of dropping them straight in —
  // worse, but better than a dead button when Stripe declines the session.
  return Response.redirect(url ?? CUSTOMER_PORTAL_URL, 303);
}
