import { env } from "cloudflare:workers";
import { ADMIN_COOKIE, isAdminCookieValid } from "@/lib/adminAuth";
import { markPaidOut } from "@/lib/referrals";
import type { VoiceAgentEnv } from "@/lib/voiceAgent";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface PayoutEnv extends VoiceAgentEnv {
  ADMIN_DASH_KEY?: string;
}

function back(request: Request, status: string): Response {
  const url = new URL("/admin", request.url);
  url.searchParams.set("payout", status);
  return Response.redirect(url.toString(), 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const cfEnv = env as unknown as PayoutEnv;
  const jar = await cookies();
  if (!(await isAdminCookieValid(jar.get(ADMIN_COOKIE)?.value, cfEnv.ADMIN_DASH_KEY))) {
    return Response.redirect(new URL("/admin?error=1", request.url).toString(), 303);
  }

  const { id } = await params;
  const paid = await markPaidOut(cfEnv, id);
  return back(request, paid ? "paid" : "failed");
}
