import { env } from "cloudflare:workers";
import { ADMIN_COOKIE, sha256Hex, timingSafeEqualStr } from "@/lib/adminAuth";
import { overRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

interface LoginEnv {
  ADMIN_DASH_KEY?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as LoginEnv;
  const deny = Response.redirect(new URL("/admin?error=1", request.url).toString(), 303);

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, ip && `admin-login:${ip}`, 10)) return deny;

  const form = await request.formData().catch(() => null);
  const key = form?.get("key");
  if (
    !cfEnv.ADMIN_DASH_KEY ||
    typeof key !== "string" ||
    !timingSafeEqualStr(key, cfEnv.ADMIN_DASH_KEY)
  ) {
    return deny;
  }

  const headers = new Headers({ Location: new URL("/admin", request.url).toString() });
  headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${await sha256Hex(cfEnv.ADMIN_DASH_KEY)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
  );
  return new Response(null, { status: 303, headers });
}
