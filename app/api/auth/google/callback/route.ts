import { env } from "cloudflare:workers";
import { timingSafeEqualStr } from "@/lib/adminAuth";
import { claimCheckoutSession } from "@/lib/claim";
import { callbackUrl, exchangeCode, verifyIdToken } from "@/lib/googleLogin";
import { type PortalEnv, findAccountByEmail, patchAccount } from "@/lib/portalApi";
import {
  OAUTH_STATE_COOKIE,
  clearedStateCookie,
  createSession,
  parseOauthState,
  sessionCookie,
} from "@/lib/session";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface CallbackEnv extends PortalEnv {
  GOOGLE_LOGIN_CLIENT_ID?: string;
  GOOGLE_LOGIN_CLIENT_SECRET?: string;
}

// A login failure lands on /login with a reason; the client must see a sentence they can act on.
function toLogin(request: Request, error: string): Response {
  const headers = new Headers({
    Location: new URL(`/login?error=${error}`, request.url).toString(),
  });
  headers.append("Set-Cookie", clearedStateCookie());
  return new Response(null, { status: 303, headers });
}

function thanksUrl(request: Request, sessionId: string, locale?: string, error?: string): string {
  const params = new URLSearchParams({ session_id: sessionId });
  if (error) params.set("error", error);
  if (locale === "es") params.set("lang", "es");
  return new URL(`/onboarding/thanks?${params}`, request.url).toString();
}

// A claim failure must land back on /thanks, never on /login and never a 500 — the client already
// paid and only needs to retry the gate.
function toThanks(request: Request, sessionId: string, error: string, locale?: string): Response {
  const headers = new Headers({ Location: thanksUrl(request, sessionId, locale, error) });
  headers.append("Set-Cookie", clearedStateCookie());
  return new Response(null, { status: 303, headers });
}

export async function GET(request: Request): Promise<Response> {
  const cfEnv = env as unknown as CallbackEnv;
  const { GOOGLE_LOGIN_CLIENT_ID, GOOGLE_LOGIN_CLIENT_SECRET } = cfEnv;

  const jar = await cookies();
  const oauthState = parseOauthState(jar.get(OAUTH_STATE_COOKIE)?.value);
  const claimSessionId = oauthState?.intent === "claim" ? oauthState.sessionId : undefined;

  const fail = (error: string): Response =>
    claimSessionId ? toThanks(request, claimSessionId, error) : toLogin(request, error);

  if (!GOOGLE_LOGIN_CLIENT_ID || !GOOGLE_LOGIN_CLIENT_SECRET) return fail("not_configured");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("oauth_failed");

  if (!oauthState || !timingSafeEqualStr(state, oauthState.state)) return fail("oauth_failed");

  const idToken = await exchangeCode(
    GOOGLE_LOGIN_CLIENT_ID,
    GOOGLE_LOGIN_CLIENT_SECRET,
    callbackUrl(request.url),
    code,
  );
  if (!idToken) return fail("oauth_failed");

  const identity = await verifyIdToken(idToken, GOOGLE_LOGIN_CLIENT_ID);
  if (!identity) return fail("oauth_failed");

  if (claimSessionId) {
    const result = await claimCheckoutSession(cfEnv, identity, claimSessionId);
    if (!result.ok) return toThanks(request, claimSessionId, result.error, result.locale);
    const headers = new Headers({
      Location: thanksUrl(request, claimSessionId, result.locale),
    });
    headers.append("Set-Cookie", sessionCookie(result.portalSessionId));
    headers.append("Set-Cookie", clearedStateCookie());
    return new Response(null, { status: 303, headers });
  }

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
