import { env } from "cloudflare:workers";
import { LandingPage } from "@/components/LandingPage";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { APP_HOST } from "@/lib/site";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageEnv {
  RATE_LIMIT_KV?: KVNamespace;
}

export default async function Page() {
  // The bare app subdomain is the dashboard, not the marketing site. This has to live in the route,
  // not worker/index.ts — wrangler's entry is vinext's, so that file never runs.
  if ((await headers()).get("host") === APP_HOST) redirect("/portal");

  const cfEnv = env as unknown as PageEnv;
  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  return <LandingPage locale="en" authed={session != null} />;
}
