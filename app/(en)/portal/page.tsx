import { env } from "cloudflare:workers";
import { ForwardingCard } from "@/components/onboarding/ForwardingCard";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { onboardingHref, parseLocale } from "@/lib/i18n/dict";
import { en } from "@/lib/i18n/en";
import { getLead, getLeadIdForAccount } from "@/lib/leads";
import { PLAN_LABELS, normalizePlan } from "@/lib/plans";
import { type PortalEnv, getActivitySummary } from "@/lib/portalApi";
import { getPortalContext } from "@/lib/portalContext";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { redirect } from "next/navigation";
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

export default async function PortalOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string; lang?: string }>;
}) {
  const cfEnv = env as unknown as PortalEnv;
  const {
    session,
    shops,
    activeShop: shop,
    activeLeadId,
  } = await getPortalContext(cfEnv, {
    allowPending: true,
  });

  // An account with no salon yet hasn't finished first-salon onboarding — send it back to the
  // wizard instead of rendering an empty dashboard.
  if (shops.length === 0) {
    // Unless it already paid: then the salon is mid-provisioning (or a failed provisioning the team
    // is fixing by hand), and the wizard would invite a second subscription. Back to setup instead.
    const paidLeadId = await getLeadIdForAccount(cfEnv.LEADS_KV, session.accountId);
    const paid = paidLeadId ? await getLead(cfEnv.LEADS_KV, paidLeadId) : null;
    if (!paid?.stripeSessionId || paid.status === "created" || paid.status === "cancelled") {
      // `lang` rides along too: this redirect is the last hop of the Spanish funnel, and the wizard
      // reads its locale from the query alone.
      const { plan, billing, lang } = await searchParams;
      const params: Record<string, string> = {};
      if (plan) params.plan = plan;
      if (billing) params.billing = billing;
      redirect(onboardingHref(parseLocale(lang), params));
    }
  }

  const leadId = activeLeadId ?? session.leadId;
  const lead = leadId ? await getLead(cfEnv.LEADS_KV, leadId) : null;

  const businessName = lead?.basics.businessName ?? shop?.name ?? "your shop";
  const number = lead?.assignedNumber ?? shop?.twilio_number;
  const calendarConnected = shop?.integration === "google_calendar";
  const calendarRequested = lead?.setup?.calendar === "google_calendar";
  const pending = Boolean(lead && lead.status !== "provisioned");
  const activity = !pending && shop ? await getActivitySummary(cfEnv, shop.id) : null;

  return (
    <>
      <PortalHeading
        title={
          <>
            {businessName}.{" "}
            <span className="text-teal">{pending ? "Setup in progress." : "All set."}</span>
          </>
        }
        lead={
          pending
            ? "Your checkout is complete. Track review, calendar connection and activation here."
            : "Change your hours, services or staff whenever they change — Marisol picks it up on the next call."
        }
      />

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Tile
          label="Receptionist"
          value={shop?.status === "active" ? "Answering calls" : "Waiting for activation"}
          hint={number}
        />
        <Tile
          label="Calendar"
          value={
            calendarConnected ? "Google Calendar" : calendarRequested ? "Not connected" : "None"
          }
          hint={
            calendarConnected ? (
              "Bookings land in it automatically"
            ) : !calendarRequested ? (
              "Using Marisol's booking schedule"
            ) : (
              <a href="/portal/calendar" className="font-medium text-teal">
                Connect it now
              </a>
            )
          }
        />
        <Tile
          label="Plan"
          value={PLAN_LABELS[normalizePlan(lead?.plan)]}
          hint={lead?.billing === "annual" ? "Billed annually" : "Billed monthly"}
        />
        <Tile
          label="Staff"
          value={String(lead?.setup?.staff.filter((m) => m.name.trim()).length ?? 0)}
          hint={
            pending ? (
              "Confirmed during onboarding"
            ) : (
              <a href="/portal/setup" className="font-medium text-teal">
                Edit your setup
              </a>
            )
          }
        />
        {activity && (
          <>
            <Tile label="Calls handled" value={String(activity.calls30d)} hint="Last 30 days" />
            <Tile
              label="Appointments booked"
              value={String(activity.bookings30d)}
              hint="Last 30 days"
            />
          </>
        )}
      </div>

      {number && !pending ? (
        lead?.forwardingConfirmedAt ? (
          <PortalNotice tone="good">
            Call forwarding is marked as set up. Calls you don't answer can reach Marisol.{" "}
            <a href="/portal/forwarding" className="font-medium underline">
              View or change forwarding
            </a>
            .
          </PortalNotice>
        ) : (
          <div>
            <ForwardingCard
              twilioNumber={number}
              carrier={lead?.setup?.carrier}
              t={en.forwarding}
            />
            <form method="post" action="/api/portal/forwarding-confirmed" className="mt-3">
              <button type="submit" className="btn btn-md btn-secondary">
                I've turned on forwarding
              </button>
            </form>
          </div>
        )
      ) : (
        <PortalNotice tone="warn">
          {number
            ? "Your number is prepared but remains inactive until our checks are complete. "
            : "Your Marisol number is being prepared. "}
          <a href={SALES_EMAIL_HREF} className="font-medium underline">
            email us
          </a>{" "}
          and we'll sort it out.
        </PortalNotice>
      )}

      {!pending && (
        <p className="mt-6 text-[14px] text-muted">
          Running another location?{" "}
          <a href="/portal/salons" className="font-medium text-teal">
            Add a location
          </a>
        </p>
      )}
    </>
  );
}
