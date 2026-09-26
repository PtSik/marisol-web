import { env } from "cloudflare:workers";
import { hmacSha256Hex } from "@/lib/crypto";
import { DEMO_AGENTS, type DemoAgent } from "@/lib/demoAgents";
import { overRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const MAX_DURATION_SECONDS = 180;

const RATE_LIMIT = 4;
const WINDOW_SECONDS = 3600;

interface TokenEnv {
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_WEBHOOK_SECRET?: string;
  VOICE_AGENT_API_URL?: string;
  VOICE_AGENT_API?: Fetcher;
  RATE_LIMIT_KV?: KVNamespace;
}

async function signWebhook(secret: string, body: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  return `t=${timestamp},v0=${await hmacSha256Hex(secret, `${timestamp}.${body}`)}`;
}

// Web sessions skip the Twilio flow, so the personalization webhook (which normally
// injects the prompt's dynamic variables per call) must be invoked here instead.
async function fetchDynamicVariables(
  agent: DemoAgent,
  apiUrl: string,
  secret: string,
  service: Fetcher | undefined,
): Promise<Record<string, string>> {
  const body = JSON.stringify({ caller_id: "", called_number: agent.calledNumber });
  const url = `${apiUrl}/webhooks/personalization`;
  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ElevenLabs-Signature": await signWebhook(secret, body),
    },
    body,
  };
  let res = service ? await service.fetch(url, init).catch(() => null) : null;
  if (!res || !res.ok) {
    res = await fetch(url, init);
  }
  if (!res.ok) {
    throw new Error(`personalization request failed: ${res.status}`);
  }
  const data = (await res.json()) as { dynamic_variables: Record<string, string | null> };
  return Object.fromEntries(
    Object.entries(data.dynamic_variables).filter(([, v]) => v != null),
  ) as Record<string, string>;
}

export async function GET(request: Request) {
  const {
    ELEVENLABS_API_KEY,
    ELEVENLABS_WEBHOOK_SECRET,
    VOICE_AGENT_API_URL,
    VOICE_AGENT_API,
    RATE_LIMIT_KV,
  } = env as unknown as TokenEnv;

  const agentId = new URL(request.url).searchParams.get("agent_id");
  const agent = DEMO_AGENTS.find((a) => a.agentId === agentId);
  if (!agent) {
    return Response.json({ error: "unknown agent_id" }, { status: 400 });
  }

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_WEBHOOK_SECRET || !VOICE_AGENT_API_URL) {
    return Response.json({ error: "token endpoint not configured" }, { status: 501 });
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(RATE_LIMIT_KV, ip && `tok:${ip}`, RATE_LIMIT, WINDOW_SECONDS)) {
    return Response.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const [tokenRes, dynamicVariables] = await Promise.all([
    fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agent.agentId)}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
    ),
    fetchDynamicVariables(
      agent,
      VOICE_AGENT_API_URL,
      ELEVENLABS_WEBHOOK_SECRET,
      VOICE_AGENT_API,
    ).catch(() => null),
  ]);
  if (!tokenRes.ok || !dynamicVariables) {
    return Response.json({ error: "failed to mint token" }, { status: 502 });
  }

  const data = (await tokenRes.json()) as { token: string };
  return Response.json({
    token: data.token,
    maxDurationSeconds: MAX_DURATION_SECONDS,
    dynamicVariables,
  });
}
