import { env } from "cloudflare:workers";
import type { PortalEnv } from "@/lib/portalApi";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Account status | Marisol",
  robots: { index: false, follow: false },
};

export default async function AccountStatusPage() {
  const session = await getSession(
    (env as unknown as PortalEnv).RATE_LIMIT_KV,
    await sessionIdFromCookies(),
  );
  if (!session) redirect("/login");
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Your dashboard is unavailable</h1>
      <p className="mt-4">
        Your service is not active or your account needs review. You can still manage your billing
        below.{" "}
        <a href={SALES_EMAIL_HREF} className="underline">
          Contact us
        </a>{" "}
        if you need help.
      </p>
      <form method="post" action="/api/portal/billing-portal" className="mt-6">
        <button type="submit" className="rounded-xl bg-ink px-6 py-3 text-cream">
          Manage billing in Stripe
        </button>
      </form>
    </main>
  );
}
