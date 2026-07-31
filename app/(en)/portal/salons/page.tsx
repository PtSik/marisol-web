import { env } from "cloudflare:workers";
import { AddSalonForm } from "@/components/portal/AddSalonForm";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { getLead } from "@/lib/leads";
import { normalizePlan } from "@/lib/plans";
import type { PortalEnv, Shop } from "@/lib/portalApi";
import { getPortalContext } from "@/lib/portalContext";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, { tone: "good" | "warn"; text: string }> = {
  done: {
    tone: "good",
    text: "That location is off — its number is released and billing adjusted.",
  },
  failed: { tone: "warn", text: "Couldn't remove that location. Try again, or email us." },
};
const ADDED: Record<string, { tone: "good" | "warn"; text: string }> = {
  done: { tone: "good", text: "Your new salon is live — pick it from the salon switcher up top." },
};

function SalonRow({ shop, primary }: { shop: Shop; primary: boolean }) {
  const cancelled = shop.status === "cancelled";
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[16px] border border-ink/10 px-[18px] py-3.5">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium">
          {shop.name ?? shop.twilio_number ?? "Salon"}
          {primary && <span className="ml-2 text-[12px] font-normal text-muted-2">Primary</span>}
        </p>
        <p className="text-[13px] text-muted-2">
          {shop.twilio_number ?? "No number yet"}
          {cancelled && " · removed"}
        </p>
      </div>
      {!primary && !cancelled && (
        <form method="post" action="/api/portal/remove-salon">
          <input type="hidden" name="shop_id" value={shop.id} />
          <button type="submit" className="text-[13.5px] font-medium text-[#B4452C]">
            Remove
          </button>
        </form>
      )}
    </li>
  );
}

export default async function PortalSalonsPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string; added?: string }>;
}) {
  const cfEnv = env as unknown as PortalEnv;
  const { session, shops } = await getPortalContext(cfEnv);
  const { removed, added } = await searchParams;

  const primary = session.leadId ? await getLead(cfEnv.LEADS_KV, session.leadId) : null;
  const plan = normalizePlan(primary?.plan);
  const billing = primary?.billing ?? "monthly";
  const defaultVertical = primary?.basics.vertical ?? "barbershop";
  const defaultTimezone = primary?.basics.timezone ?? "America/New_York";

  const activeSalons = shops.filter((s) => s.status !== "cancelled").length;
  const removedNotice = removed ? NOTICE[removed] : undefined;
  const addedNotice = added ? ADDED[added] : undefined;

  return (
    <>
      <PortalHeading
        title="Your salons"
        lead="Every location on one account and one bill. Each keeps its own number, hours and staff — switch between them from the menu up top."
      />

      {addedNotice && <PortalNotice tone={addedNotice.tone}>{addedNotice.text}</PortalNotice>}
      {removedNotice && <PortalNotice tone={removedNotice.tone}>{removedNotice.text}</PortalNotice>}

      <ul className="mt-7 list-none space-y-2 p-0">
        {shops.map((shop) => (
          <SalonRow key={shop.id} shop={shop} primary={shop.id === session.shopId} />
        ))}
      </ul>

      <div className="mt-8">
        <AddSalonForm
          plan={plan}
          billing={billing}
          activeSalons={activeSalons}
          defaultVertical={defaultVertical}
          defaultTimezone={defaultTimezone}
        />
      </div>
    </>
  );
}
