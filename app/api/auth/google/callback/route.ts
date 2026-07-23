import { env } from "cloudflare:workers";
import { timingSafeEqualStr } from "@/lib/adminAuth";
import { callbackUrl, exchangeCode, verifyIdToken } from "@/lib/googleLogin";
import { findAccountByEmail, patchAccount } from "@/lib/portalApi";
import {
  OAUTH_STATE_COOKIE,
  clearedStateCookie,
  createSession,
  sessionCookie,
} from "@/lib/session";
import type { VoiceAgentEnv } from "@/lib/voiceAgent";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface CallbackEnv extends VoiceAgentEnv {
  GOOGLE_LOGIN_CLIENT_ID?: string;
  GOOGLE_LOGIN_CLIENT_SECRET?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

// Every failure path lands on /login with a reason: a client who mistypes their Google account
// must see a sentence they can act on, never a 500.
function toLogin(request: Request, error: string): Response {
  const headers = new Headers({
    Location: new URL(`/login?error=${error}`, request.url).toString(),
  });
  headers.append("Set-Cookie", clearedStateCookie());
  return new Response(null, { status: 303, headers });
}

export async function GET(request: Request): Promise<Response> {
  const cfEnv = env as unknown as CallbackEnv;
  const { GOOGLE_LOGIN_CLIENT_ID, GOOGLE_LOGIN_CLIENT_SECRET } = cfEnv;
  if (!GOOGLE_LOGIN_CLIENT_ID || !GOOGLE_LOGIN_CLIENT_SECRET) {
    return toLogin(request, "not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return toLogin(request, "oauth_failed");

  const jar = await cookies();
  const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  if (!expectedState || !timingSafeEqualStr(state, expectedState)) {
    return toLogin(request, "oauth_failed");
  }

  const idToken = await exchangeCode(
    GOOGLE_LOGIN_CLIENT_ID,
    GOOGLE_LOGIN_CLIENT_SECRET,
    callbackUrl(request.url),
    code,
  );
  if (!idToken) return toLogin(request, "oauth_failed");

  const identity = await verifyIdToken(idToken, GOOGLE_LOGIN_CLIENT_ID);
  if (!identity) return toLogin(request, "oauth_failed");

  const account = await findAccountByEmail(cfEnv, identity.email);
  if (!account) return toLogin(request, "unknown_email");

  await patchAccount(cfEnv, account.id, {
    google_sub: identity.sub,
    last_login_at: new Date().toISOString(),
  });

  const sessionId = await createSession(cfEnv.RATE_LIMIT_KV, {
    accountId: account.id,
    email: account.email,
    shopId: account.shop_id ?? undefined,
    leadId: account.lead_id ?? undefined,
  });
  if (!sessionId) return toLogin(request, "session_failed");

  const headers = new Headers({ Location: new URL("/portal", request.url).toString() });
  headers.append("Set-Cookie", sessionCookie(sessionId));
  headers.append("Set-Cookie", clearedStateCookie());
  return new Response(null, { status: 303, headers });
}
