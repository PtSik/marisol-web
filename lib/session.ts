import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const PORTAL_COOKIE = "marisol_session";
export const OAUTH_STATE_COOKIE = "marisol_oauth";

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

export const sessionCookie = (id: string) => cookie(PORTAL_COOKIE, id, SESSION_TTL_SECONDS);
export const clearedSessionCookie = () => cookie(PORTAL_COOKIE, "", 0);
export const stateCookie = (state: string) => cookie(OAUTH_STATE_COOKIE, state, STATE_TTL_SECONDS);
export const clearedStateCookie = () => cookie(OAUTH_STATE_COOKIE, "", 0);

export async function sessionIdFromCookies(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(PORTAL_COOKIE)?.value;
}

// Every /portal page starts here: no session (or one KV expired out from under the cookie)
// means the visitor is a stranger, not a client with a broken page.
export async function requirePortalSession(kv: KVNamespace | undefined): Promise<PortalSession> {
  const session = await getSession(kv, await sessionIdFromCookies());
  if (!session) redirect("/login");
  return session;
}
