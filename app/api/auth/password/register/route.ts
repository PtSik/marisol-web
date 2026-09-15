import { env } from "cloudflare:workers";
import { createVerifyToken } from "@/lib/authTokens";
import { sendVerificationEmail } from "@/lib/notify";
import { EMAIL_RE } from "@/lib/onboarding";
import { type PortalEnv, registerAccount } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";
import { createSession, sessionCookie } from "@/lib/session";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const PASSWORD_MIN_LEN = 8;
const PASSWORD_MAX_LEN = 200;

interface RegisterRequest {
  email?: string;
  password?: string;
  confirm?: string;
  terms?: boolean;
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, ip && `auth:register:${ip}`, 10)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let body: RegisterRequest;
  try {
    body = (await request.json()) as RegisterRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "invalid email" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < PASSWORD_MIN_LEN || password.length > PASSWORD_MAX_LEN) {
    return Response.json(
      { error: `password must be at least ${PASSWORD_MIN_LEN} characters` },
      { status: 400 },
    );
  }
  if (body.confirm !== password) {
    return Response.json({ error: "passwords do not match" }, { status: 400 });
  }
  if (body.terms !== true) {
    return Response.json({ error: "you must agree to the Terms" }, { status: 400 });
  }

  const created = await registerAccount(cfEnv, { email, password });
  if (!created.ok) {
    return created.reason === "exists"
      ? Response.json({ error: "an account with this email already exists" }, { status: 409 })
      : Response.json({ error: "could not create account" }, { status: 502 });
  }
  const account = created.account;

  const sessionId = await createSession(cfEnv.RATE_LIMIT_KV, {
    accountId: account.id,
    email: account.email,
  });
  if (!sessionId) {
    return Response.json({ error: "could not create session" }, { status: 502 });
  }

  // Soft verification: never block on send failure, the account already works without it.
  const token = await createVerifyToken(cfEnv.RATE_LIMIT_KV, account.id);
  if (token) {
    await sendVerificationEmail(cfEnv, {
      email,
      verifyUrl: `${SITE_URL}/api/auth/verify?token=${token}`,
    });
  }

  const response = Response.json({ redirect: "/onboarding" });
  response.headers.append("Set-Cookie", sessionCookie(sessionId));
  return response;
}
