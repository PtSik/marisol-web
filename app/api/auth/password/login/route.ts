import { env } from "cloudflare:workers";
import { getLeadIdForAccount } from "@/lib/leads";
import { EMAIL_RE } from "@/lib/onboarding";
import { type PortalEnv, verifyAccountPassword } from "@/lib/portalApi";
import { bumpRateLimit, clearRateLimit, rateLimited } from "@/lib/rateLimit";
import { createSession, sessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

interface LoginRequest {
  email?: string;
  password?: string;
}

// Two buckets, and only failed attempts fill either. The per-account one is the real brute-force
// defence; the per-IP one is a wide backstop against someone spraying many accounts, set high
// enough that a salon whose whole team shares one NAT address never reaches it by signing in.
const FAILURES_PER_IP = 50;
const FAILURES_PER_ACCOUNT = 10;

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;
  const kv = cfEnv.RATE_LIMIT_KV;

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const ipKey = ip && `auth:login:${ip}`;
  const tooMany = () => Response.json({ error: "too many requests" }, { status: 429 });
  if (await rateLimited(kv, ipKey, FAILURES_PER_IP)) return tooMany();

  let body: LoginRequest;
  try {
    body = (await request.json()) as LoginRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const invalid = () => Response.json({ error: "invalid email or password" }, { status: 401 });
  // A malformed address matches no account, so it only costs the IP bucket — there is no account
  // bucket to charge, and the length cap keeps it from writing an oversized KV key.
  if (!EMAIL_RE.test(email) || email.length > 160 || !password) {
    await bumpRateLimit(kv, ipKey);
    return invalid();
  }

  const accountKey = `auth:login:acct:${email}`;
  if (await rateLimited(kv, accountKey, FAILURES_PER_ACCOUNT)) return tooMany();

  const account = await verifyAccountPassword(cfEnv, email, password);
  if (!account) {
    await Promise.all([bumpRateLimit(kv, ipKey), bumpRateLimit(kv, accountKey)]);
    return invalid();
  }

  // Proving you own the account clears its failure streak — a mistyped password earlier in the
  // hour must not count against the owner who then gets it right.
  await clearRateLimit(kv, accountKey);

  // Checkout links the account to its lead immediately in KV; the operational account row gains
  // lead_id later when its shop is prepared. A returning paid client must still enter the portal
  // during that gap instead of reopening their completed onboarding draft.
  const leadId = account.lead_id ?? (await getLeadIdForAccount(cfEnv.LEADS_KV, account.id));

  const sessionId = await createSession(cfEnv.RATE_LIMIT_KV, {
    accountId: account.id,
    email: account.email,
    shopId: account.shop_id ?? undefined,
    leadId: leadId ?? undefined,
  });
  if (!sessionId) {
    return Response.json({ error: "could not create session" }, { status: 502 });
  }

  const response = Response.json({
    redirect: !account.shop_id && !leadId ? "/onboarding" : "/portal",
  });
  response.headers.append("Set-Cookie", sessionCookie(sessionId));
  return response;
}
