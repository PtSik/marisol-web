import { env } from "cloudflare:workers";
import { getLead, putLead } from "@/lib/leads";
import { portalAccessRedirect } from "@/lib/portalAccess";
import type { PortalEnv } from "@/lib/portalApi";
import { resolveAccountShops } from "@/lib/portalContext";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;
  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);
  if (await portalAccessRedirect(cfEnv, session)) {
    return Response.json({ error: "service is not active" }, { status: 403 });
  }

  const { activeLeadId, activeShop } = await resolveAccountShops(cfEnv, session);
  const lead = activeLeadId ? await getLead(cfEnv.LEADS_KV, activeLeadId) : null;
  if (!lead || !activeShop?.twilio_number) {
    return Response.json({ error: "phone number is not ready" }, { status: 409 });
  }
  lead.forwardingConfirmedAt ??= new Date().toISOString();
  await putLead(cfEnv.LEADS_KV, lead);
  return Response.redirect(new URL("/portal", request.url).toString(), 303);
}
