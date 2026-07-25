import { env } from "cloudflare:workers";
import { ForwardingCard } from "@/components/onboarding/ForwardingCard";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { en } from "@/lib/i18n/en";
import { getLead } from "@/lib/leads";
import { PLAN_LABELS } from "@/lib/plans";
import type { PortalEnv } from "@/lib/portalApi";
import { getPortalContext } from "@/lib/portalContext";
import { SALES_EMAIL_HREF } from "@/lib/site";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

function Tile({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="rounded-[16px] border border-ink/10 bg-cream-100 px-[18px] py-4">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-2">
        {label}
      </p>
      <p className="mt-1.5 text-[16px] font-medium">{value}</p>
      {hint && <p className="mt-0.5 text-[13px] leading-[1.45] text-muted-2">{hint}</p>}
    </div>
  );
}

export default async function PortalOverviewPage() {
  const cfEnv = env as unknown as PortalEnv;
  const { activeShop: shop, activeLeadId } = await getPortalContext(cfEnv);
  const lead = activeLeadId ? await getLead(cfEnv.LEADS_KV, activeLeadId) : null;

  const businessName = lead?.basics.businessName ?? shop?.name ?? "your shop";
  const number = lead?.assignedNumber ?? shop?.twilio_number;
  const calendarConnected = shop?.integration === "google_calendar";

  return (
    <>
      <PortalHeading
        title={
          <>
            {businessName}. <span className="text-teal">All set.</span>
          </>
        }
        lead="Change your hours, services or staff whenever they change — Marisol picks it up on the next call."
      />

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Tile
          label="Receptionist"
          value={shop?.status === "active" ? "Answering calls" : (shop?.status ?? "Setting up")}
          hint={number}
        />
        <Tile
          label="Calendar"
          value={calendarConnected ? "Google Calendar" : "Not connected"}
          hint={
            calendarConnected ? (
              "Bookings land in it automatically"
            ) : (
              <a href="/portal/calendar" className="font-medium text-teal">
                Connect it now
              </a>
            )
          }
        />
        <Tile
          label="Plan"
          value={PLAN_LABELS[lead?.plan ?? "base"]}
          hint={lead?.billing === "annual" ? "Billed annually" : "Billed monthly"}
        />
        <Tile
          label="Staff"
          value={String(lead?.setup?.staff.filter((m) => m.name.trim()).length ?? 0)}
          hint={
            <a href="/portal/setup" className="font-medium text-teal">
              Edit your setup
            </a>
          }
        />
      </div>

      {number ? (
        <ForwardingCard
          twilioNumber={number}
          forwardMode={lead?.setup?.forwardMode ?? "conditional"}
          t={en.forwarding}
        />
      ) : (
        <PortalNotice tone="warn">
          Your Marisol number isn't assigned yet. If you finished checkout more than a few minutes
          ago,{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium underline">
            email us
          </a>{" "}
          and we'll sort it out.
        </PortalNotice>
      )}
    </>
  );
}
