import { env } from "cloudflare:workers";
import { buildAuthUrl, callbackUrl } from "@/lib/googleLogin";
import { overRateLimit } from "@/lib/rateLimit";
import { type OauthState, stateCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

interface AuthEnv {
  GOOGLE_LOGIN_CLIENT_ID?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

function fail(request: Request, error: string): Response {
  return Response.redirect(new URL(`/login?error=${error}`, request.url).toString(), 303);
}

export async function GET(request: Request): Promise<Response> {
  const cfEnv = env as unknown as AuthEnv;

  if (!cfEnv.GOOGLE_LOGIN_CLIENT_ID) return fail(request, "not_configured");

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, ip && `oauth:${ip}`, 20)) {
    return fail(request, "rate_limited");
  }

  const state = crypto.randomUUID();
  const payload: OauthState = { state };
  const headers = new Headers({
    Location: buildAuthUrl(cfEnv.GOOGLE_LOGIN_CLIENT_ID, callbackUrl(request.url), state),
  });
  headers.append("Set-Cookie", stateCookie(payload));
  return new Response(null, { status: 303, headers });
}
