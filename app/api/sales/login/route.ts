import { env } from "cloudflare:workers";
import { sha256Hex, timingSafeEqualStr } from "@/lib/dashAuth";
import { SALES_COOKIE, SALES_REP_COOKIE, looksLikeKey, normaliseRep } from "@/lib/salesAuth";

export const dynamic = "force-dynamic";

interface LoginEnv {
  SALES_DASH_KEY?: string;
}

// No attempt limit here on purpose: the key is 32 random characters, so guessing it is not the
// threat — locking the team out of its own call queue mid-shift is.
export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as LoginEnv;
  const deny = Response.redirect(new URL("/sales?error=1", request.url).toString(), 303);

  const form = await request.formData().catch(() => null);
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
  const headers = new Headers({ Location: new URL("/sales", request.url).toString() });
  headers.append(
    "Set-Cookie",
    `${SALES_COOKIE}=${await sha256Hex(cfEnv.SALES_DASH_KEY)}; ${shared}`,
  );
  headers.append("Set-Cookie", `${SALES_REP_COOKIE}=${encodeURIComponent(rep)}; ${shared}`);
  return new Response(null, { status: 303, headers });
}
