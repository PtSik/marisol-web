import { env } from "cloudflare:workers";
import { PortalNav } from "@/components/portal/PortalNav";
import type { PortalEnv } from "@/lib/portalApi";
import { requirePortalSession } from "@/lib/session";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your portal — Marisol",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const cfEnv = env as unknown as PortalEnv;
  const session = await requirePortalSession(cfEnv.RATE_LIMIT_KV);

  return (
    <>
      <PortalNav email={session.email} />
      <main className="mx-auto max-w-[760px] px-[22px] pb-[clamp(48px,7vw,88px)] pt-[clamp(28px,4vw,44px)]">
        {children}
      </main>
    </>
  );
}
