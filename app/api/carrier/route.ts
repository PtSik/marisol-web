import { env } from "cloudflare:workers";
import { type Carrier, carrierFromLookup } from "@/lib/forwarding";
import { overRateLimit } from "@/lib/rateLimit";
import { type TwilioEnv, lookupLineType, toUsE164 } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 20;
// Which network a number is on changes only when it is ported, so yesterday's answer is still the
// right one. The debounce alone re-asks Twilio for every surviving keystroke pass, and again if the
// owner reopens the form.
const CACHE_TTL_SECONDS = 86_400;

interface CarrierEnv extends TwilioEnv {
  RATE_LIMIT_KV?: KVNamespace;
}

interface CarrierResponse {
  carrier: Carrier | null;
}

// KV stores strings, and "" reads back as a miss — a resolved-to-nothing lookup needs its own token.
const NO_CARRIER = "none";

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as CarrierEnv;

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `carrier:${ip}`, RATE_LIMIT)) {
    return Response.json({ carrier: null } satisfies CarrierResponse);
  }

  let body: { phone?: unknown };
  try {
    body = (await request.json()) as { phone?: unknown };
  } catch {
    return Response.json({ carrier: null } satisfies CarrierResponse);
  }

  // Provisioning is US-only, so a number Twilio would bill us to look up but we could never act on
  // never leaves the worker.
  const e164 = typeof body.phone === "string" ? toUsE164(body.phone) : null;
  if (!e164) return Response.json({ carrier: null } satisfies CarrierResponse);

  const cacheKey = `carrier-lookup:${e164}`;
  const cached = await cfEnv.RATE_LIMIT_KV?.get(cacheKey);
  if (cached) {
    const carrier = cached === NO_CARRIER ? null : (cached as Carrier);
    return Response.json({ carrier } satisfies CarrierResponse);
  }

  const lookup = await lookupLineType(cfEnv, e164);
  const carrier = lookup ? carrierFromLookup(lookup) : null;
  // A failed lookup is not cached: it is usually Twilio being briefly unavailable, and caching it
  // would hold the owner on the generic hint for a day.
  if (lookup) {
    await cfEnv.RATE_LIMIT_KV?.put(cacheKey, carrier ?? NO_CARRIER, {
      expirationTtl: CACHE_TTL_SECONDS,
    }).catch(() => {});
  }
  return Response.json({ carrier } satisfies CarrierResponse);
}
