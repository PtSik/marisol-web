import { env } from "cloudflare:workers";
import { isPayoutMethod, normalisePayoutHandle } from "@/lib/payout";
import { type PortalEnv, findAccountByEmail } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { claimReferralPayout } from "@/lib/referrals";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

function back(request: Request, status: string): Response {
  const url = new URL("/portal/referrals", request.url);
  url.searchParams.set("payout", status);
  return Response.redirect(url.toString(), 303);
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;

  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);

  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `payout:${session.accountId}`, 10)) {
    return back(request, "failed");
  }

  const form = await request.formData().catch(() => null);
  const method = form?.get("method");
  if (!isPayoutMethod(method)) return back(request, "invalid");
  const handle = normalisePayoutHandle(method, form?.get("handle"));
  if (!handle) return back(request, "invalid");

  const account = await findAccountByEmail(cfEnv, session.email);
  if (!account) return back(request, "failed");

  const claimedCents = await claimReferralPayout(cfEnv, account, method, handle);
  return back(request, claimedCents > 0 ? "requested" : "none");
}
