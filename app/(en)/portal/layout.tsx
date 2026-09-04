import { env } from "cloudflare:workers";
import { type NavShop, PortalNav } from "@/components/portal/PortalNav";
import { SupportForm } from "@/components/portal/SupportForm";
import { getLead, getLeadIdForAccount, isDashboardLocked } from "@/lib/leads";
import type { PortalEnv } from "@/lib/portalApi";
import { getPortalContext } from "@/lib/portalContext";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your portal — Marisol",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const cfEnv = env as unknown as PortalEnv;
  const { session, shops, activeShopId } = await getPortalContext(cfEnv);

  // A paid client can know or bookmark /portal. Keep the dashboard unavailable until the assisted
  // review has actually activated the receptionist; hiding only its CTA is not an access gate.
  const primaryLeadId =
    session.leadId ?? (await getLeadIdForAccount(cfEnv.LEADS_KV, session.accountId));
  const primaryLead = primaryLeadId ? await getLead(cfEnv.LEADS_KV, primaryLeadId) : null;
  if (primaryLead && isDashboardLocked(primaryLead.status) && primaryLead.stripeSessionId) {
    const lang = primaryLead.locale === "es" ? "&lang=es" : "";
    redirect(`/onboarding/thanks?session_id=${primaryLead.stripeSessionId}${lang}`);
  }

  const navShops: NavShop[] = shops.map((shop) => ({
    id: shop.id,
    name: shop.name ?? shop.twilio_number ?? "Salon",
  }));

  return (
    <>
      <PortalNav shops={navShops} activeShopId={activeShopId} />
      <main className="mx-auto max-w-[760px] px-[22px] pt-[clamp(28px,4vw,44px)]">{children}</main>
      <footer className="mx-auto max-w-[760px] px-[22px] pb-[clamp(48px,7vw,88px)] pt-[clamp(28px,4vw,44px)]">
        <SupportForm />
      </footer>
    </>
  );
}
