import { env } from "cloudflare:workers";
import { LandingPage } from "@/components/LandingPage";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

interface PageEnv {
  RATE_LIMIT_KV?: KVNamespace;
}

export default async function Page() {
  const cfEnv = env as unknown as PageEnv;
  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  return <LandingPage locale="en" authed={session != null} />;
}
