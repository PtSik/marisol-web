import { env } from "cloudflare:workers";
import { ForwardingCard } from "@/components/onboarding/ForwardingCard";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { en } from "@/lib/i18n/en";
import { getLead } from "@/lib/leads";
import type { PortalEnv } from "@/lib/portalApi";
import { getPortalContext } from "@/lib/portalContext";
import { SALES_EMAIL_HREF } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function PortalForwardingPage() {
  const cfEnv = env as unknown as PortalEnv;
  const { activeShop, activeLeadId } = await getPortalContext(cfEnv);
  const lead = activeLeadId ? await getLead(cfEnv.LEADS_KV, activeLeadId) : null;
  const number = lead?.assignedNumber ?? activeShop?.twilio_number;

  return (
    <>
      <PortalHeading
        title="Forward your calls"
        lead="Your exact code, for your carrier. Two minutes on the phone you're forwarding."
      />
      {number ? (
        <ForwardingCard twilioNumber={number} carrier={lead?.setup?.carrier} t={en.forwarding} />
      ) : (
        <PortalNotice tone="warn">
          Your Marisol number isn't assigned yet — there's nothing to forward to.{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium underline">
            Email us
          </a>{" "}
          if you finished checkout more than a few minutes ago.
        </PortalNotice>
      )}
    </>
  );
}
