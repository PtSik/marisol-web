import { env } from "cloudflare:workers";
import { createResetToken } from "@/lib/authTokens";
import { sendPasswordResetEmail } from "@/lib/notify";
import { EMAIL_RE } from "@/lib/onboarding";
import { type PortalEnv, findAccountByEmail } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

interface ResetRequestBody {
  email?: string;
}

// Always 200 with the same body, whether the account exists, the address is malformed, or the IP
// is rate-limited — an attacker learns nothing about which emails have accounts.
export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;
  const ok = Response.json({ ok: true });

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, ip && `auth:reset-request:${ip}`, 10)) {
    return ok;
  }

  let body: ResetRequestBody;
  try {
    body = (await request.json()) as ResetRequestBody;
  } catch {
    return ok;
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return ok;

  const account = await findAccountByEmail(cfEnv, email);
  if (!account) return ok;

  const token = await createResetToken(cfEnv.RATE_LIMIT_KV, account.id);
  if (token) {
    await sendPasswordResetEmail(cfEnv, {
      email,
      resetUrl: `${SITE_URL}/reset-password?token=${token}`,
    });
  }
  return ok;
}
