import { env } from "cloudflare:workers";
import { getLead, putLead } from "@/lib/leads";
import { type SetupDetails, TIMEZONE_IDS, validateSetupPayload } from "@/lib/onboarding";
import { portalAccessRedirect } from "@/lib/portalAccess";
import type { PortalEnv } from "@/lib/portalApi";
import { resolveAccountShops } from "@/lib/portalContext";
import {
  patchShop,
  toServiceCatalog,
  toShopHours,
  toShopServices,
  toShopStaff,
} from "@/lib/provisioning";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

interface SetupRequest {
  setup?: SetupDetails;
  timezone?: string;
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;

  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.json({ error: "not signed in" }, { status: 401 });
  if (await portalAccessRedirect(cfEnv, session)) {
    return Response.json({ error: "service is not active" }, { status: 403 });
  }

  if (await overRateLimit(cfEnv.RATE_LIMIT_KV, `portal-setup:${session.accountId}`, 60)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let body: SetupRequest;
  try {
    body = (await request.json()) as SetupRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const error = validateSetupPayload(body.setup);
  if (error) return Response.json({ error }, { status: 400 });
  const setup = body.setup as SetupDetails;

  const timezone = body.timezone;
  if (timezone !== undefined && !TIMEZONE_IDS.some((id) => id === timezone)) {
    return Response.json({ error: "invalid timezone" }, { status: 400 });
  }

  // The salon the switcher is pointed at — resolved against the account's own shops, so the edit
  // can only ever land on a location this owner holds.
  const { activeShopId, activeLeadId } = await resolveAccountShops(cfEnv, session);
  const lead = activeLeadId ? await getLead(cfEnv.LEADS_KV, activeLeadId) : null;
  if (!lead) return Response.json({ error: "no setup on file" }, { status: 404 });

  if (lead.flowVersion === 2 && setup.services.some((s) => s.durationMaxMin?.trim()))
    return Response.json({ error: "invalid services" }, { status: 400 });
  lead.setup = setup;
  if (timezone) lead.basics.timezone = timezone;
  await putLead(cfEnv.LEADS_KV, lead);

  // The shop row is derived from the lead, so a failed PATCH means the two have drifted —
  // the client has to see that, not a green tick over stale agent config.
  const shopUpdated = activeShopId
    ? await patchShop(cfEnv, activeShopId, {
        ...(lead.flowVersion === 2 ? { service_catalog: toServiceCatalog(setup) } : {}),
        hours_json: JSON.stringify(toShopHours(setup.hours)),
        services_json: JSON.stringify(toShopServices(setup.services)),
        staff_json: JSON.stringify(toShopStaff(setup)),
        // Editable after onboarding too, otherwise a client who moves premises or changes their
        // walk-in policy has no way to tell the agent.
        address: lead.basics.address?.trim() || null,
        notes: setup.notes.trim() || null,
        ...(timezone ? { timezone } : {}),
      })
    : false;

  return Response.json({ ok: true, shopUpdated });
}
