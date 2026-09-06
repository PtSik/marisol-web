import { env } from "cloudflare:workers";
import { portalAccessRedirect } from "@/lib/portalAccess";
import { type PortalEnv, listAccountShops } from "@/lib/portalApi";
import { getSession, sessionIdFromCookies, shopCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

// A relative same-origin path only — never let the form send the client to another site.
function safeReturnTo(raw: string | null, base: string): string {
  if (raw?.startsWith("/") && !raw.startsWith("//")) return new URL(raw, base).toString();
  return new URL("/portal", base).toString();
}

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as PortalEnv;

  const session = await getSession(cfEnv.RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 303);
  if (await portalAccessRedirect(cfEnv, session)) {
    return Response.json({ error: "service is not active" }, { status: 403 });
  }

  const form = await request.formData();
  const target = String(form.get("shop_id") ?? "");
  const returnTo = safeReturnTo(String(form.get("return_to") ?? ""), request.url);

  // The switch is only accepted for a salon the account actually owns — the one check that keeps
  // one signed-in owner from pointing the portal at another shop's data.
  const owned = await listAccountShops(cfEnv, session.accountId);
  if (!owned.some((s) => s.id === target && s.status !== "cancelled" && s.status !== "suspended")) {
    return Response.json({ error: "not your salon" }, { status: 403 });
  }

  const headers = new Headers({ Location: returnTo });
  headers.append("Set-Cookie", shopCookie(target));
  return new Response(null, { status: 303, headers });
}
