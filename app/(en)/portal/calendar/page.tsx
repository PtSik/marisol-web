import { env } from "cloudflare:workers";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { getLead } from "@/lib/leads";
import type { PortalEnv } from "@/lib/portalApi";
import { getPortalContext } from "@/lib/portalContext";
import { buildCalendarConnectUrl } from "@/lib/provisioning";
import { SALES_EMAIL_HREF } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function PortalCalendarPage() {
  const cfEnv = env as unknown as PortalEnv;
  const {
    activeShop: shop,
    activeShopId,
    activeLeadId,
  } = await getPortalContext(cfEnv, {
    allowPending: true,
  });
  const lead = activeLeadId ? await getLead(cfEnv.LEADS_KV, activeLeadId) : null;
  const accessGranted = Boolean(
    lead?.calendarAccessGrantedAt ||
      shop?.calendar_access_granted_at ||
      shop?.integration === "google_calendar",
  );
  const connectUrl =
    activeShopId && accessGranted ? await buildCalendarConnectUrl(cfEnv, activeShopId) : undefined;

  const connected = shop?.integration === "google_calendar";
  const requested = lead?.setup?.calendar === "google_calendar" || connected;
  const writeCalendar = shop?.calendar_routing?.write_calendar_id;

  return (
    <>
      <PortalHeading
        title="Google Calendar"
        lead={
          requested
            ? "Connected, every booking Marisol takes appears in your calendar — and anything you block out there stops her offering that slot."
            : "You chose to use Marisol without Google Calendar. You can ask us to add it later."
        }
      />

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
            {requested
              ? "Marisol still takes bookings — connecting your calendar means your team does not have to copy them across by hand."
              : "Marisol keeps appointments in its own booking schedule. Your team will need to manage other calendars separately."}
          </p>
        )}

        {connectUrl ? (
          <a
            href={connectUrl}
            className="mt-6 inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream no-underline"
          >
            {connected ? "Reconnect or change calendars" : "Connect Google Calendar"}
          </a>
        ) : requested ? (
          <PortalNotice tone="warn">
            {accessGranted
              ? "We couldn’t build your connect link. "
              : "We’re preparing your Google Calendar access. We’ll email you when it’s ready. "}
            <a href={SALES_EMAIL_HREF} className="font-medium underline">
              Email us
            </a>{" "}
            and we'll send you one.
          </PortalNotice>
        ) : (
          <p className="mt-6 text-[14px] leading-[1.55] text-muted">
            Want to connect Google Calendar?{" "}
            <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
              Email us
            </a>{" "}
            and we'll enable it for you.
          </p>
        )}

        {requested && (
          <p className="mt-4 text-[13.5px] leading-[1.5] text-muted-2">
            You'll be asked to sign in with Google and pick which calendar bookings go into.
            Choosing a different calendar later is the same button.
          </p>
        )}
      </div>
    </>
  );
}
