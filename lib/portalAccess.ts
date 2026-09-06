import { accountLeadKey, getLeadStrict, isDashboardLocked } from "@/lib/leads";
import { type PortalEnv, getShop } from "@/lib/portalApi";
import type { PortalSession } from "@/lib/session";

// Re-read lifecycle on every request; a session can outlive the subscription by weeks.
export async function portalAccessRedirect(
  env: PortalEnv,
  session: PortalSession,
): Promise<string | null> {
  if (!env.LEADS_KV) throw new Error("LEADS_KV is not configured");
  const leadId = session.leadId ?? (await env.LEADS_KV.get(accountLeadKey(session.accountId)));
  if (!leadId) {
    const shop = session.shopId ? await getShop(env, session.shopId) : null;
    return shop && ["active", "trial", "demo"].includes(shop.status ?? "")
      ? null
      : "/account-status";
  }
  const lead = await getLeadStrict(env.LEADS_KV, leadId);
  if (!lead) return "/account-status";
  if (!isDashboardLocked(lead.status)) return null;
  if (lead.stripeSessionId) {
    const lang = lead.locale === "es" ? "&lang=es" : "";
    return `/onboarding/thanks?session_id=${encodeURIComponent(lead.stripeSessionId)}${lang}`;
  }
  return "/account-status";
}
