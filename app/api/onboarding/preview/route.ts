import { env } from "cloudflare:workers";
import { readDraft } from "@/lib/onboardingDraft";
import { previewVariables } from "@/lib/onboardingPreview";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";
interface PreviewEnv {
  OUTREACH_DB?: D1Database;
  RATE_LIMIT_KV?: KVNamespace;
  ELEVENLABS_API_KEY?: string;
  ONBOARDING_PREVIEW_AGENT_ID?: string;
}
export async function POST(request: Request) {
  const e = env as unknown as PreviewEnv;
  const session = await getSession(e.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.json({ error: "not signed in" }, { status: 401 });
  if (!e.OUTREACH_DB || !e.RATE_LIMIT_KV || !e.ELEVENLABS_API_KEY || !e.ONBOARDING_PREVIEW_AGENT_ID)
    return Response.json({ error: "preview unavailable" }, { status: 503 });
  if (await overRateLimit(e.RATE_LIMIT_KV, `onboarding-preview:${session.accountId}`, 4))
    return Response.json({ error: "preview limit reached" }, { status: 429 });
  try {
    const record = await readDraft(e.OUTREACH_DB, session.accountId);
    if (!record?.draft.basics.businessName.trim())
      return Response.json({ error: "save business details first" }, { status: 400 });
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(e.ONBOARDING_PREVIEW_AGENT_ID)}`,
      { headers: { "xi-api-key": e.ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) throw new Error("provider unavailable");
    const body = (await res.json()) as { token?: string };
    if (!body.token) throw new Error("missing token");
    const locale = new URL(request.url).searchParams.get("lang") === "es" ? "es" : "en";
    return Response.json(
      {
        token: body.token,
        dynamicVariables: previewVariables(record.draft, locale),
        maxDurationSeconds: 120,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "preview unavailable" }, { status: 503 });
  }
}
