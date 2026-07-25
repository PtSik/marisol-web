import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const EVENTS = new Set([
  "demo_started",
  "demo_completed",
  "wizard_step",
  "plan_picked",
  "plan_picker_dismissed",
  "checkout_redirect",
  "setup_completed",
]);

interface TrackEnv {
  FUNNEL_AE?: AnalyticsEngineDataset;
}

export async function POST(request: Request) {
  let body: { event?: unknown; meta?: unknown };
  try {
    body = (await request.json()) as { event?: unknown; meta?: unknown };
  } catch {
    return Response.json({ ok: true });
  }

  const { event, meta } = body;
  if (typeof event !== "string" || !EVENTS.has(event)) {
    return Response.json({ ok: true });
  }

  const { FUNNEL_AE } = env as unknown as TrackEnv;
  FUNNEL_AE?.writeDataPoint({
    blobs: [event, typeof meta === "string" ? meta.slice(0, 100) : ""],
    doubles: [1],
    indexes: [event],
  });
  return Response.json({ ok: true });
}
