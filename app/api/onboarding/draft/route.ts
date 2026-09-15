import { env } from "cloudflare:workers";
import { isOnboardingDraft, readDraft, saveDraft } from "@/lib/onboardingDraft";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";
interface DraftEnv {
  OUTREACH_DB?: D1Database;
  RATE_LIMIT_KV?: KVNamespace;
}

export async function GET() {
  const e = env as unknown as DraftEnv;
  const session = await getSession(e.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.json({ error: "not signed in" }, { status: 401 });
  if (!e.OUTREACH_DB) return Response.json({ error: "saving unavailable" }, { status: 503 });
  try {
    return Response.json(
      { record: await readDraft(e.OUTREACH_DB, session.accountId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "saving unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const e = env as unknown as DraftEnv;
  const session = await getSession(e.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.json({ error: "not signed in" }, { status: 401 });
  if (!e.OUTREACH_DB) return Response.json({ error: "saving unavailable" }, { status: 503 });
  let body: { revision?: number; draft?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 40000) return Response.json({ error: "draft too large" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid draft" }, { status: 400 });
  }
  if (
    !body ||
    !Number.isSafeInteger(body.revision) ||
    (body.revision as number) < 0 ||
    !isOnboardingDraft(body.draft)
  ) {
    return Response.json({ error: "invalid draft" }, { status: 400 });
  }
  body.draft.basics.email = session.email;
  try {
    const revision = await saveDraft(
      e.OUTREACH_DB,
      session.accountId,
      body.revision as number,
      body.draft,
    );
    return revision === null
      ? Response.json({ error: "draft changed in another tab" }, { status: 409 })
      : Response.json({ revision });
  } catch {
    return Response.json({ error: "saving unavailable" }, { status: 503 });
  }
}
