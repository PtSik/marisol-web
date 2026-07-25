import { env } from "cloudflare:workers";
import { consumeVerifyToken } from "@/lib/authTokens";
import { type PortalEnv, patchAccount } from "@/lib/portalApi";

export const dynamic = "force-dynamic";

// Soft verification: an invalid or already-used token still lands the visitor on their dashboard
// rather than an error page — there is nothing actionable for them to do about a dead link.
export async function GET(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;
  const token = new URL(request.url).searchParams.get("token") ?? "";

  const accountId = token ? await consumeVerifyToken(cfEnv.RATE_LIMIT_KV, token) : null;
  if (accountId) {
    await patchAccount(cfEnv, accountId, { email_verified: true });
  }

  return Response.redirect(new URL("/portal", request.url).toString(), 303);
}
