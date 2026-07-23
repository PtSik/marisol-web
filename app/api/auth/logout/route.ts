import { env } from "cloudflare:workers";
import { clearedSessionCookie, destroySession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

interface LogoutEnv {
  RATE_LIMIT_KV?: KVNamespace;
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as LogoutEnv;
  await destroySession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());

  const headers = new Headers({ Location: new URL("/", request.url).toString() });
  headers.append("Set-Cookie", clearedSessionCookie());
  return new Response(null, { status: 303, headers });
}
