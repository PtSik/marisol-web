import { env } from "cloudflare:workers";
import { getLead, getLeadIdForAccount, putLead } from "@/lib/leads";
import type { PortalEnv } from "@/lib/portalApi";
import { resolveAccountShops } from "@/lib/portalContext";
import { buildCalendarConnectUrl, patchShop } from "@/lib/provisioning";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

function back(request: Request, result: string): Response {
  const url = new URL("/portal/calendar", request.url);
  url.searchParams.set("connect", result);
  return Response.redirect(url.toString(), 303);
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;
  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `calendar-connect:${session.accountId}`, 10)) {
    return back(request, "failed");
  }

  // Only an active shop owned by this account can mint a connect link. Pending shops remain under
  // team review, and a posted shop id is never trusted from the browser.
  const context = await resolveAccountShops(cfEnv, session);
  const shop = context.activeShop;
  if (!shop || shop.status !== "active") return back(request, "pending");

  const grantedAt = shop.calendar_access_granted_at ?? new Date().toISOString();
  if (!shop.calendar_access_granted_at) {
    const updated = await patchShop(cfEnv, shop.id, { calendar_access_granted_at: grantedAt });
    if (!updated) return back(request, "failed");
  }

  const leadId =
    context.activeLeadId ??
    session.leadId ??
    (await getLeadIdForAccount(cfEnv.LEADS_KV, session.accountId));
  const lead = leadId ? await getLead(cfEnv.LEADS_KV, leadId) : null;
  if (lead) {
    lead.calendarAccessGrantedAt = grantedAt;
    if (lead.setup) lead.setup = { ...lead.setup, calendar: "google_calendar" };
    await putLead(cfEnv.LEADS_KV, lead);
  }

  const url = await buildCalendarConnectUrl(cfEnv, shop.id);
  return url ? Response.redirect(url, 303) : back(request, "failed");
}
