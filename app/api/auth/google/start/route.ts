import { env } from "cloudflare:workers";
import { buildAuthUrl, callbackUrl } from "@/lib/googleLogin";
import { overRateLimit } from "@/lib/rateLimit";
import { type OauthState, stateCookie } from "@/lib/session";
import { SESSION_ID_RE } from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface AuthEnv {
  GOOGLE_LOGIN_CLIENT_ID?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export async function GET(request: Request): Promise<Response> {
  const cfEnv = env as unknown as AuthEnv;
  const url = new URL(request.url);
  const rawSessionId = url.searchParams.get("session_id") ?? "";
  const sessionId = SESSION_ID_RE.test(rawSessionId) ? rawSessionId : undefined;
  const claiming = url.searchParams.get("intent") === "claim" && Boolean(sessionId);

  // A claim keeps the client inside the post-payment flow; only login errors fall to /login.
  const fail = (error: string): Response => {
    const target =
      claiming && sessionId
        ? `/onboarding/thanks?session_id=${encodeURIComponent(sessionId)}&error=${error}`
        : `/login?error=${error}`;
    return Response.redirect(new URL(target, request.url).toString(), 303);
  };

  if (!cfEnv.GOOGLE_LOGIN_CLIENT_ID) return fail("not_configured");

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, ip && `oauth:${ip}`, 20)) {
    return fail("rate_limited");
  }

  const state = crypto.randomUUID();
  const payload: OauthState = {
    state,
    intent: claiming ? "claim" : "login",
    ...(claiming && sessionId ? { sessionId } : {}),
  };
  const headers = new Headers({
    Location: buildAuthUrl(cfEnv.GOOGLE_LOGIN_CLIENT_ID, callbackUrl(request.url), state),
  });
  headers.append("Set-Cookie", stateCookie(payload));
  return new Response(null, { status: 303, headers });
}
