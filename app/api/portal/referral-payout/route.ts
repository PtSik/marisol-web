import { env } from "cloudflare:workers";
import { notifyTeam } from "@/lib/notify";
import { type PortalEnv, findAccountByEmail } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { cashCents, listReferrals, requestCashPayout } from "@/lib/referrals";
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

  const account = await findAccountByEmail(cfEnv, session.email);
  if (!account) return back(request, "failed");

  const credited = await listReferrals(cfEnv, { referrer: account.id, status: "credited" });
  if (credited.length === 0) return back(request, "none");
  const cashOwed = credited.reduce((sum, r) => sum + cashCents(r.amount_cents), 0);

  const requested = await requestCashPayout(cfEnv, account.id);
  if (requested === 0) return back(request, "none");

  await notifyTeam(cfEnv, `💵 Cash payout requested — ${session.email}`, {
    accountId: account.id,
    email: session.email,
    referrals: requested,
    cashToSend: `$${cashOwed / 100}`,
    note: "Reverse the unused Stripe credit (half stays with them), wire the cash, then mark it paid out in /admin.",
  });
  return back(request, "requested");
}
