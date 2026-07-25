import { env } from "cloudflare:workers";
import { consumeResetToken } from "@/lib/authTokens";
import { type PortalEnv, patchAccount } from "@/lib/portalApi";
import { overRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const PASSWORD_MIN_LEN = 8;
const PASSWORD_MAX_LEN = 200;

interface ResetBody {
  token?: string;
  password?: string;
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, ip && `auth:reset:${ip}`, 10)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < PASSWORD_MIN_LEN || password.length > PASSWORD_MAX_LEN) {
    return Response.json(
      { error: `password must be at least ${PASSWORD_MIN_LEN} characters` },
      { status: 400 },
    );
  }

  const accountId = token ? await consumeResetToken(cfEnv.RATE_LIMIT_KV, token) : null;
  if (!accountId) {
    return Response.json({ error: "invalid or expired link" }, { status: 400 });
  }

  const account = await patchAccount(cfEnv, accountId, { password });
  if (!account) {
    return Response.json({ error: "could not reset password" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
