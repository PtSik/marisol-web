import { env } from "cloudflare:workers";
import {
  type BusinessMatch,
  importHours,
  importServices,
  publicWebsite,
} from "@/lib/businessImport";
import { overRateLimit } from "@/lib/rateLimit";
import { getSession, sessionIdFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";
interface BusinessEnv {
  OUTREACH_DB?: D1Database;
  RATE_LIMIT_KV?: KVNamespace;
}
export async function GET(request: Request) {
  const e = env as unknown as BusinessEnv;
  const session = await getSession(e.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.json({ error: "not signed in" }, { status: 401 });
  if (await overRateLimit(e.RATE_LIMIT_KV, `business-search:${session.accountId}`, 40))
    return Response.json({ error: "too many searches" }, { status: 429 });
  if (!e.OUTREACH_DB) return Response.json({ error: "lookup unavailable" }, { status: 503 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  try {
    if (id) {
      if (id.length > 80) return Response.json({ error: "invalid business" }, { status: 400 });
      // Only public business facts. Never select sales notes, call outcomes or owners.
      const row =
        await e.OUTREACH_DB.prepare(`SELECT l.shop_name, l.phone_e164, l.address, l.hours, l.website,
        e.services, e.service_confidence, e.source_url, e.fetched_at
        FROM leads l LEFT JOIN lead_enrichment e ON e.lead_id = l.id WHERE l.id = ?`)
          .bind(id)
          .first<{
            shop_name: string;
            phone_e164: string;
            address: string | null;
            hours: string | null;
            website: string | null;
            services: string | null;
            service_confidence: string | null;
            source_url: string | null;
            fetched_at: string | null;
          }>();
      if (!row) return Response.json({ error: "business not found" }, { status: 404 });
      return Response.json(
        {
          profile: {
            basics: {
              businessName: row.shop_name,
              businessPhone: row.phone_e164,
              address: row.address ?? "",
            },
            hours: importHours(row.hours),
            services: importServices(row.services, row.service_confidence),
            sourceUrl: publicWebsite(row.source_url ?? row.website),
            researchedAt: row.fetched_at,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (q.length < 3 || q.length > 120) return Response.json({ matches: [] });
    const escaped = q.replace(/[\\%_]/g, "\\$&");
    const rows = await e.OUTREACH_DB.prepare(
      "SELECT id, shop_name AS name, address FROM leads WHERE shop_name LIKE ? ESCAPE '\\' ORDER BY shop_name LIMIT 8",
    )
      .bind(`%${escaped}%`)
      .all<BusinessMatch>();
    return Response.json({ matches: rows.results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "lookup unavailable" }, { status: 503 });
  }
}
