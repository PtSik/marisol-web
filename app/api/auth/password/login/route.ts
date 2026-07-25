import { env } from "cloudflare:workers";
import { EMAIL_RE } from "@/lib/onboarding";
import { type PortalEnv, verifyAccountPassword } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { createSession, sessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

interface LoginRequest {
  email?: string;
  password?: string;
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, ip && `auth:login:${ip}`, 10)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let body: LoginRequest;
  try {
    body = (await request.json()) as LoginRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const invalid = () => Response.json({ error: "invalid email or password" }, { status: 401 });
  if (!EMAIL_RE.test(email) || !password) return invalid();

  const account = await verifyAccountPassword(cfEnv, email, password);
  if (!account) return invalid();

  const sessionId = await createSession(cfEnv.RATE_LIMIT_KV, {
    accountId: account.id,
    email: account.email,
    shopId: account.shop_id ?? undefined,
    leadId: account.lead_id ?? undefined,
  });
  if (!sessionId) {
    return Response.json({ error: "could not create session" }, { status: 502 });
  }

  const response = Response.json({ redirect: "/portal" });
  response.headers.append("Set-Cookie", sessionCookie(sessionId));
  return response;
}
