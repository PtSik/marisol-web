import { env } from "cloudflare:workers";
import { timingSafeEqualStr } from "@/lib/adminAuth";
import { callbackUrl, exchangeCode, verifyIdToken } from "@/lib/googleLogin";
import { appHref } from "@/lib/i18n/dict";
import { getLeadIdForAccount } from "@/lib/leads";
import { type PortalEnv, createAccount, findAccountByEmail, patchAccount } from "@/lib/portalApi";
import {
  clearedStateCookie,
  createSession,
  oauthStateCookieName,
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

export async function GET(request: Request): Promise<Response> {
  const cfEnv = env as unknown as CallbackEnv;
  const { GOOGLE_LOGIN_CLIENT_ID, GOOGLE_LOGIN_CLIENT_SECRET } = cfEnv;

  const jar = await cookies();
  const oauthState = parseOauthState(jar.get(oauthStateCookieName())?.value);

  if (!GOOGLE_LOGIN_CLIENT_ID || !GOOGLE_LOGIN_CLIENT_SECRET) {
    return toLogin(request, "not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return toLogin(request, "oauth_failed");

  if (!oauthState || !timingSafeEqualStr(state, oauthState.state)) {
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

  // Google is a sign-up method too, not just a login for clients we already know, so an unknown
  // address gets an account rather than a dead end. Falling back to create is safe even when the
  // lookup merely failed: create is get-or-create by email, and the id token already proved this
  // caller owns that (Google-verified) address — so the row it returns is theirs either way.
  const account =
    (await findAccountByEmail(cfEnv, identity.email)) ??
    (await createAccount(cfEnv, { email: identity.email }));
  if (!account) return toLogin(request, "session_failed");

  await patchAccount(cfEnv, account.id, {
    google_sub: identity.sub,
    email_verified: true,
    last_login_at: new Date().toISOString(),
  });

  const leadId = account.lead_id ?? (await getLeadIdForAccount(cfEnv.LEADS_KV, account.id));

  const sessionId = await createSession(cfEnv.RATE_LIMIT_KV, {
    accountId: account.id,
    email: account.email,
    shopId: account.shop_id ?? undefined,
    leadId: leadId ?? undefined,
  });
  if (!sessionId) return toLogin(request, "session_failed");

  // The locale survived the round trip in the state cookie. A brand new Google account goes to
  // onboarding directly; an existing account still enters its protected portal/status resolver.
  const headers = new Headers({
    Location: appHref(
      oauthState.lang === "es" ? "es" : "en",
      !account.shop_id && !leadId ? "/onboarding" : "/portal",
    ),
  });
  headers.append("Set-Cookie", sessionCookie(sessionId));
  headers.append("Set-Cookie", clearedStateCookie());
  return new Response(null, { status: 303, headers });
}
