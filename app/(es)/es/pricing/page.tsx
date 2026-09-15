import { env } from "cloudflare:workers";
import { PricingPage } from "@/components/PricingPage";
import { getDict } from "@/lib/i18n/dict";
import { siteMetadata } from "@/lib/metadata";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

const { title, description } = getDict("es").pricing.meta;

export const metadata = siteMetadata({ locale: "es", title, description, path: "/es/pricing" });

interface PageEnv {
  RATE_LIMIT_KV?: KVNamespace;
}

export default async function Page() {
  const cfEnv = env as unknown as PageEnv;
  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  return <PricingPage locale="es" authed={session != null} />;
}
