import { env } from "cloudflare:workers";
import { portalAccessRedirect } from "@/lib/portalAccess";
import { type PortalEnv, findAccountByEmail } from "@/lib/portalApi";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Production's cookies carry Domain=.callmarisol.com, so the browser sends them to the preview host
// too. Two cookies of one name would then arrive together and `jar.get` would pick between them by
// nothing in particular, so preview names its own (COOKIE_PREFIX); production leaves it unset.
const named = (base: string) => `${(env as { COOKIE_PREFIX?: string }).COOKIE_PREFIX ?? ""}${base}`;

export const portalCookieName = () => named("marisol_session");
export const oauthStateCookieName = () => named("marisol_oauth");
// Which salon the portal is currently showing. Only ever honoured after it is checked against the
// account's own shops, so a forged value buys nothing — it just falls back to the first salon.
export const shopCookieName = () => named("marisol_shop");

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const STATE_TTL_SECONDS = 600;

export interface PortalSession {
  accountId: string;
  email: string;
  shopId?: string;
  leadId?: string;
  createdAt: string;
}

const sessionKey = (id: string) => `sess:${id}`;

export async function createSession(
  kv: KVNamespace | undefined,
  session: Omit<PortalSession, "createdAt">,
): Promise<string | null> {
  if (!kv) return null;
  const id = crypto.randomUUID();
  const record: PortalSession = { ...session, createdAt: new Date().toISOString() };
  await kv.put(sessionKey(id), JSON.stringify(record), { expirationTtl: SESSION_TTL_SECONDS });
  return id;
}

export async function getSession(
  kv: KVNamespace | undefined,
  id: string | undefined,
): Promise<PortalSession | null> {
  if (!kv || !id) return null;
  try {
    return await kv.get<PortalSession>(sessionKey(id), "json");
  } catch {
    return null;
  }
}

// Overwrites the record under the same id — the cookie stays valid, so provisioning can back-fill
// shopId onto a live gate session without logging the client out.
export async function refreshSession(
  kv: KVNamespace | undefined,
  id: string,
  patch: Partial<PortalSession>,
): Promise<PortalSession | null> {
  const existing = await getSession(kv, id);
  if (!kv || !existing) return existing;
  const record: PortalSession = { ...existing, ...patch };
  await kv
    .put(sessionKey(id), JSON.stringify(record), { expirationTtl: SESSION_TTL_SECONDS })
    .catch(() => {});
  return record;
}

export async function destroySession(
  kv: KVNamespace | undefined,
  id: string | undefined,
): Promise<void> {
  if (!kv || !id) return;
  await kv.delete(sessionKey(id)).catch(() => {});
}

// Domain is scoped to .callmarisol.com (via the COOKIE_DOMAIN var) so one session cookie is shared
// between the marketing site and the app.callmarisol.com dashboard. Empty on localhost dev, where a
// Domain attribute would stop the cookie from being set at all.
function cookie(name: string, value: string, maxAge: number): string {
  const domain = (env as { COOKIE_DOMAIN?: string }).COOKIE_DOMAIN;
  const domainAttr = domain ? `; Domain=${domain}` : "";
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/${domainAttr}; Max-Age=${maxAge}`;
}

export interface OauthState {
  state: string;
  // Only ever "es": English is the default the callback falls back to, so an absent value and an
  // explicit "en" have to mean the same thing.
  lang?: "es";
}

function b64urlEncode(json: string): string {
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
}

export const sessionCookie = (id: string) => cookie(portalCookieName(), id, SESSION_TTL_SECONDS);
export const clearedSessionCookie = () => cookie(portalCookieName(), "", 0);
export const stateCookie = (payload: OauthState) =>
  cookie(oauthStateCookieName(), b64urlEncode(JSON.stringify(payload)), STATE_TTL_SECONDS);
export const clearedStateCookie = () => cookie(oauthStateCookieName(), "", 0);
export const shopCookie = (shopId: string) => cookie(shopCookieName(), shopId, SESSION_TTL_SECONDS);

// Falls back to "bare string ⇒ state" so a state cookie minted before this deploy still validates.
export function parseOauthState(raw: string | undefined): OauthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(raw)) as Partial<OauthState>;
    if (parsed && typeof parsed.state === "string") {
      return { state: parsed.state, ...(parsed.lang === "es" ? { lang: "es" as const } : {}) };
    }
  } catch {
    /* not our JSON payload — a bare-string cookie from a previous deploy */
  }
  return { state: raw };
}

export async function sessionIdFromCookies(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(portalCookieName())?.value;
}

export async function shopIdFromCookies(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(shopCookieName())?.value;
}

// Every /portal page starts here: no session (or one KV expired out from under the cookie)
// means the visitor is a stranger, not a client with a broken page. A gate session minted before
// provisioning finished has no shopId yet — resolve it from the account so the portal isn't empty.
export async function requirePortalSession(env: PortalEnv): Promise<PortalSession> {
  const kv = env.RATE_LIMIT_KV;
  const id = await sessionIdFromCookies();
  let session = await getSession(kv, id);
  if (!session) redirect("/login");
  // A session minted before the first shop/lead was linked can outlive that account update. Refresh
  // it before resolving access so a now-active customer is not mistaken for a new setup account.
  if (!session.shopId && id) {
    const account = await findAccountByEmail(env, session.email);
    if (account?.shop_id || account?.lead_id) {
      const refreshed = await refreshSession(kv, id, {
        shopId: account.shop_id ?? session.shopId,
        leadId: account.lead_id ?? session.leadId,
      });
      if (refreshed) session = refreshed;
    }
  }
  const blocked = await portalAccessRedirect(env, session);
  if (blocked) redirect(blocked);
  return session;
}
