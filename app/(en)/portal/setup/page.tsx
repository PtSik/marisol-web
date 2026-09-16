import { env } from "cloudflare:workers";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { PortalSetupForm } from "@/components/portal/PortalSetupForm";
import { en } from "@/lib/i18n/en";
import { getLead } from "@/lib/leads";
import { coerceTimezone, defaultSetup } from "@/lib/onboarding";
import type { PortalEnv } from "@/lib/portalApi";
import { getPortalContext } from "@/lib/portalContext";
import { SALES_EMAIL_HREF } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function PortalSetupPage() {
  const cfEnv = env as unknown as PortalEnv;
  const { activeLeadId } = await getPortalContext(cfEnv);
  const lead = activeLeadId ? await getLead(cfEnv.LEADS_KV, activeLeadId) : null;

  if (!lead) {
    return (
      <>
        <PortalHeading title="Your setup" />
        <PortalNotice tone="warn">
          We couldn't load your setup.{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium underline">
            Email us
          </a>{" "}
          and we'll fix it — nothing about your receptionist has changed.
        </PortalNotice>
      </>
    );
  }

  const vertical = lead.basics.vertical;

  return (
    <>
      <PortalHeading
        title="Your setup"
        lead="Services, hours, staff and business notes. Save and Marisol uses the new details on the very next call."
      />
      <PortalSetupForm
        initialSetup={lead.setup ?? defaultSetup(vertical, en.setup.servicePresets[vertical])}
        initialTimezone={coerceTimezone(lead.basics.timezone)}
        vertical={vertical}
      />
    </>
  );
}
