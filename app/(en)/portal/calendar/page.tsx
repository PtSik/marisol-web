import { env } from "cloudflare:workers";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { getLead, getLeadIdForAccount } from "@/lib/leads";
import type { PortalEnv } from "@/lib/portalApi";
import { getPortalContext } from "@/lib/portalContext";
import { buildCalendarConnectUrl } from "@/lib/provisioning";

export const dynamic = "force-dynamic";

export default async function PortalCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const cfEnv = env as unknown as PortalEnv;
  const {
    activeShop: shop,
    activeShopId,
    activeLeadId,
    session,
  } = await getPortalContext(cfEnv, {
    allowPending: true,
  });
  const leadId =
    activeLeadId ??
    session.leadId ??
    (await getLeadIdForAccount(cfEnv.LEADS_KV, session.accountId));
  const lead = leadId ? await getLead(cfEnv.LEADS_KV, leadId) : null;
  const accessGranted = Boolean(
    lead?.calendarAccessGrantedAt ||
      shop?.calendar_access_granted_at ||
      shop?.integration === "google_calendar",
  );
  const connectUrl =
    activeShopId && accessGranted ? await buildCalendarConnectUrl(cfEnv, activeShopId) : undefined;

  const connected = shop?.integration === "google_calendar";
  const requested = lead?.setup?.calendar === "google_calendar" || connected;
  const active = shop?.status === "active";
  const writeCalendar = shop?.calendar_routing?.write_calendar_id;
  const { connect } = await searchParams;

  return (
    <>
      <PortalHeading
        title="Google Calendar"
        lead={
          connected
            ? "Every booking Marisol takes appears in your calendar, and blocked time stays unavailable."
            : requested
              ? "You selected Google Calendar during setup. Connect it here after activation."
              : "Google Calendar was not selected during setup. You can connect it here after activation."
        }
      />

      {connect === "pending" && (
        <PortalNotice tone="warn">
          Google Calendar can be connected here once your service is activated.
        </PortalNotice>
      )}
      {connect === "failed" && (
        <PortalNotice tone="warn">
          We couldn’t start Google authorization. Please try again in a moment.
        </PortalNotice>
      )}

      <div className="mt-7 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          Status
        </p>
        <p className="mt-1.5 font-display text-[clamp(22px,3.4vw,28px)] tracking-[-0.02em]">
          {connected ? "Connected" : "Not connected"}
        </p>
        {connected && writeCalendar && (
          <p className="mt-2 break-all text-[14px] text-muted">
            Bookings are written to <span className="font-medium text-ink">{writeCalendar}</span>.
          </p>
        )}
        {!connected && (
          <p className="mt-2 text-[15px] leading-[1.55] text-muted">
            {active
              ? "Connect Google Calendar so bookings appear automatically and busy times cannot be offered."
              : "Calendar connection becomes available after Marisol is activated."}
          </p>
        )}

        {connectUrl ? (
          <a
            href={connectUrl}
            className="mt-6 inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream no-underline"
          >
            {connected ? "Reconnect or change calendars" : "Connect Google Calendar"}
          </a>
        ) : active && activeShopId ? (
          <form method="post" action="/api/portal/calendar-connect" className="mt-6">
            <button type="submit" className="btn btn-md btn-primary">
              Connect Google Calendar
            </button>
          </form>
        ) : (
          <PortalNotice tone="warn">
            Google Calendar can be connected here once your service is activated.
          </PortalNotice>
        )}

        {(requested || active) && (
          <p className="mt-4 text-[13.5px] leading-[1.5] text-muted-2">
            You'll be asked to sign in with Google and pick which calendar bookings go into.
            Choosing a different calendar later is the same button.
          </p>
        )}
      </div>
    </>
  );
}
