import { env } from "cloudflare:workers";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { type PortalEnv, getShop } from "@/lib/portalApi";
import { buildCalendarConnectUrl } from "@/lib/provisioning";
import { requirePortalSession } from "@/lib/session";
import { SALES_EMAIL_HREF } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function PortalCalendarPage() {
  const cfEnv = env as unknown as PortalEnv;
  const session = await requirePortalSession(cfEnv);
  const shop = session.shopId ? await getShop(cfEnv, session.shopId) : null;
  const connectUrl = session.shopId
    ? await buildCalendarConnectUrl(cfEnv, session.shopId)
    : undefined;

  const connected = shop?.integration === "google_calendar";
  const writeCalendar = shop?.calendar_routing?.write_calendar_id;

  return (
    <>
      <PortalHeading
        title="Google Calendar"
        lead="Connected, every booking Marisol takes appears in your calendar — and anything you block out there stops her offering that slot."
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
            Marisol still takes bookings and confirms them by SMS — connecting your calendar just
            means you stop copying them across by hand.
          </p>
        )}

        {connectUrl ? (
          <a
            href={connectUrl}
            className="mt-6 inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream no-underline"
          >
            {connected ? "Reconnect or change calendars" : "Connect Google Calendar"}
          </a>
        ) : (
          <PortalNotice tone="warn">
            We couldn't build your connect link.{" "}
            <a href={SALES_EMAIL_HREF} className="font-medium underline">
              Email us
            </a>{" "}
            and we'll send you one.
          </PortalNotice>
        )}

        <p className="mt-4 text-[13.5px] leading-[1.5] text-muted-2">
          You'll be asked to sign in with Google and pick which calendar bookings go into. Choosing
          a different calendar later is the same button.
        </p>
      </div>
    </>
  );
}
