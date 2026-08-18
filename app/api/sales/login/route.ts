import { env } from "cloudflare:workers";
import { sha256Hex, timingSafeEqualStr } from "@/lib/dashAuth";
import {
  SALES_COOKIE,
  SALES_REP_COOKIE,
  looksLikeKey,
  normaliseRep,
  salesReturnTo,
} from "@/lib/salesAuth";

export const dynamic = "force-dynamic";

interface LoginEnv {
  SALES_DASH_KEY?: string;
}

// No attempt limit here on purpose: the key is 32 random characters, so guessing it is not the
// threat — locking the team out of its own call queue mid-shift is.
export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as LoginEnv;
  const form = await request.formData().catch(() => null);
  // Signing in from a lead someone shared has to land on that lead — dropping the rep on the queue
  // loses the link they were sent, which is the whole point of a lead having its own address.
  const next = salesReturnTo(form?.get("next"), request.url) ?? new URL("/sales", request.url);
  const denied = new URL(next);
  denied.searchParams.set("error", "1");
  const deny = Response.redirect(denied.toString(), 303);

  const key = form?.get("key");
  const rep = normaliseRep(form?.get("rep"));
  if (
    !cfEnv.SALES_DASH_KEY ||
    typeof key !== "string" ||
    !timingSafeEqualStr(key, cfEnv.SALES_DASH_KEY) ||
    !rep ||
    looksLikeKey(rep, cfEnv.SALES_DASH_KEY)
  ) {
    return deny;
  }

  const shared = "HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000";
  const headers = new Headers({ Location: next.toString() });
  headers.append(
    "Set-Cookie",
    `${SALES_COOKIE}=${await sha256Hex(cfEnv.SALES_DASH_KEY)}; ${shared}`,
  );
  headers.append("Set-Cookie", `${SALES_REP_COOKIE}=${encodeURIComponent(rep)}; ${shared}`);
  return new Response(null, { status: 303, headers });
}
