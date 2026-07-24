import { type PortalEnv, findAccountByEmail } from "@/lib/portalApi";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const PORTAL_COOKIE = "marisol_session";
export const OAUTH_STATE_COOKIE = "marisol_oauth";
export const CHECKOUT_COOKIE = "marisol_checkout";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const STATE_TTL_SECONDS = 600;
const CHECKOUT_TTL_SECONDS = 7 * 24 * 60 * 60;

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

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

// The gate carries where to send the client back (the paid checkout) through Google's redirect. It
// rides in the cookie, not KV — KV is eventually consistent and the callback can land in another
// colo. A forged cookie buys nothing: the cs_… it names is still verified against Stripe.
export interface OauthState {
  state: string;
  intent: "login" | "claim";
  sessionId?: string;
}

function b64urlEncode(json: string): string {
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
}

export const sessionCookie = (id: string) => cookie(PORTAL_COOKIE, id, SESSION_TTL_SECONDS);
export const clearedSessionCookie = () => cookie(PORTAL_COOKIE, "", 0);
export const stateCookie = (payload: OauthState) =>
  cookie(OAUTH_STATE_COOKIE, b64urlEncode(JSON.stringify(payload)), STATE_TTL_SECONDS);
export const clearedStateCookie = () => cookie(OAUTH_STATE_COOKIE, "", 0);
export const checkoutCookie = (sessionId: string) =>
  cookie(CHECKOUT_COOKIE, sessionId, CHECKOUT_TTL_SECONDS);

// Falls back to "bare string ⇒ login" so a state cookie minted before this deploy still validates.
export function parseOauthState(raw: string | undefined): OauthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(raw)) as Partial<OauthState>;
    if (parsed && typeof parsed.state === "string") {
      return {
        state: parsed.state,
        intent: parsed.intent === "claim" ? "claim" : "login",
        sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
      };
    }
  } catch {
    /* not our JSON payload — a bare-string cookie from a previous deploy */
  }
  return { state: raw, intent: "login" };
}

export async function sessionIdFromCookies(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(PORTAL_COOKIE)?.value;
}

// Every /portal page starts here: no session (or one KV expired out from under the cookie)
// means the visitor is a stranger, not a client with a broken page. A gate session minted before
// provisioning finished has no shopId yet — resolve it from the account so the portal isn't empty.
export async function requirePortalSession(env: PortalEnv): Promise<PortalSession> {
  const kv = env.RATE_LIMIT_KV;
  const id = await sessionIdFromCookies();
  const session = await getSession(kv, id);
  if (!session) redirect("/login");
  if (!session.shopId && id) {
    const account = await findAccountByEmail(env, session.email);
    if (account?.shop_id) {
      const refreshed = await refreshSession(kv, id, {
        shopId: account.shop_id,
        leadId: account.lead_id ?? session.leadId,
      });
      if (refreshed) return refreshed;
    }
  }
  return session;
}
