import { env } from "cloudflare:workers";
import { type NavShop, PortalNav } from "@/components/portal/PortalNav";
import { SupportForm } from "@/components/portal/SupportForm";
import type { PortalEnv } from "@/lib/portalApi";
import { getPortalContext } from "@/lib/portalContext";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your portal — Marisol",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const cfEnv = env as unknown as PortalEnv;
  const { shops, activeShopId } = await getPortalContext(cfEnv);

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
