import { env } from "cloudflare:workers";
import { clearedSessionCookie, destroySession, sessionIdFromCookies } from "@/lib/session";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

interface LogoutEnv {
  RATE_LIMIT_KV?: KVNamespace;
}

export async function POST(): Promise<Response> {
  const cfEnv = env as unknown as LogoutEnv;
  await destroySession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());

  // `/` on app.callmarisol.com is the dashboard entry point and immediately routes back through
  // portal authentication. Send a signed-out client to the public site explicitly.
  const headers = new Headers({ Location: `${SITE_URL}/` });
  headers.append("Set-Cookie", clearedSessionCookie());
  return new Response(null, { status: 303, headers });
}
