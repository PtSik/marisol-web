import { env } from "cloudflare:workers";
import { getLead } from "@/lib/leads";
import { type NotifyEnv, notifyTeam } from "@/lib/notify";
import type { PortalEnv } from "@/lib/portalApi";
import { resolveAccountShops } from "@/lib/portalContext";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOPICS = {
  forwarding_voip: "Forwarding — VoIP / business line",
  forwarding_codes: "Forwarding — codes didn't work",
  general: "General question",
} as const;

type Topic = keyof typeof TOPICS;

function isTopic(value: unknown): value is Topic {
  return typeof value === "string" && value in TOPICS;
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv & NotifyEnv;

  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.json({ error: "not signed in" }, { status: 401 });

  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `support:${session.accountId}`, 5)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let body: { topic?: unknown; message?: unknown };
  try {
    body = (await request.json()) as { topic?: unknown; message?: unknown };
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!isTopic(body.topic)) return Response.json({ error: "invalid topic" }, { status: 400 });
  if (body.message !== undefined && typeof body.message !== "string") {
    return Response.json({ error: "invalid message" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

  const { activeShop, activeLeadId } = await resolveAccountShops(cfEnv, session);
  const lead = activeLeadId ? await getLead(cfEnv.LEADS_KV, activeLeadId) : null;
  const business = lead?.basics.businessName ?? activeShop?.name ?? session.email;

  await notifyTeam(cfEnv, `🆘 ${TOPICS[body.topic]}: ${business}`, {
    Topic: TOPICS[body.topic],
    Business: business,
    Owner: lead?.basics.ownerName,
    Email: session.email,
    Phone: lead?.basics.ownerMobile ?? lead?.basics.businessPhone,
    "Marisol number": lead?.assignedNumber ?? activeShop?.twilio_number,
    "Forwarding from": lead?.setup?.forwardNumber,
    Carrier: lead?.setup?.carrier ?? "unknown",
    Message: message,
    "Lead ID": activeLeadId,
    "Shop ID": activeShop?.id,
  });

  return Response.json({ ok: true });
}
