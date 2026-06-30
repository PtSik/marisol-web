import { env } from "cloudflare:workers";
import { DEMO_AGENTS } from "@/lib/demoAgents";

export const dynamic = "force-dynamic";

const MAX_DURATION_SECONDS = 180;

const RATE_LIMIT = 4;
const WINDOW_SECONDS = 3600;

interface TokenEnv {
  ELEVENLABS_API_KEY?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

async function overRateLimit(kv: KVNamespace | undefined, ip: string): Promise<boolean> {
  if (!kv || !ip) return false;
  const key = `tok:${ip}`;
  const count = Number((await kv.get(key)) ?? 0);
  if (count >= RATE_LIMIT) return true;
  await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SECONDS });
  return false;
}

export async function GET(request: Request) {
  const { ELEVENLABS_API_KEY, RATE_LIMIT_KV } = env as unknown as TokenEnv;

  const agentId = new URL(request.url).searchParams.get("agent_id");
  if (!agentId || !DEMO_AGENTS.some((a) => a.agentId === agentId)) {
    return Response.json({ error: "unknown agent_id" }, { status: 400 });
  }

  if (!ELEVENLABS_API_KEY) {
    return Response.json({ error: "token endpoint not configured" }, { status: 501 });
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(RATE_LIMIT_KV, ip)) {
    return Response.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
  );
  if (!res.ok) {
    return Response.json({ error: "failed to mint token" }, { status: 502 });
  }

  const data = (await res.json()) as { token: string };
  return Response.json({ token: data.token, maxDurationSeconds: MAX_DURATION_SECONDS });
}
