import type { NotifyEnv } from "@/lib/notify";
import { type VoiceAgentEnv, voiceAgentFetch } from "@/lib/voiceAgent";

export interface PortalEnv extends VoiceAgentEnv, NotifyEnv {
  RATE_LIMIT_KV?: KVNamespace;
  LEADS_KV?: KVNamespace;
  STRIPE_SECRET_KEY?: string;
}

export interface Account {
  id: string;
  email: string;
  google_sub?: string | null;
  shop_id?: string | null;
  lead_id?: string | null;
  referral_code: string;
  role: string;
  payout_method?: string | null;
  payout_handle?: string | null;
}

export interface Shop {
  id: string;
  name?: string;
  account_id?: string | null;
  status?: string;
  timezone?: string;
  integration?: string;
  twilio_number?: string;
  reminders_enabled?: boolean;
  calendar_routing?: { write_calendar_id?: string } | null;
}

async function jsonOf<T>(res: Response | null, key: string): Promise<T | null> {
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as Record<string, T> | null;
  return body?.[key] ?? null;
}

export async function findAccountByEmail(
  env: VoiceAgentEnv,
  email: string,
): Promise<Account | null> {
  const res = await voiceAgentFetch(
    env,
    `/admin/accounts?email=${encodeURIComponent(email)}`,
  ).catch(() => null);
  return jsonOf<Account>(res, "account");
}

export async function createAccount(
  env: VoiceAgentEnv,
  account: { email: string; password?: string; shop_id?: string; lead_id?: string },
): Promise<Account | null> {
  const res = await voiceAgentFetch(env, "/admin/accounts", {
    method: "POST",
    body: JSON.stringify(account),
  }).catch(() => null);
  return jsonOf<Account>(res, "account");
}

// Verifies a plaintext password against the hash held in voice-agent — the hash never travels to
// or through the landing worker. Wrong password and unknown email both come back null.
export async function verifyAccountPassword(
  env: VoiceAgentEnv,
  email: string,
  password: string,
): Promise<Account | null> {
  const res = await voiceAgentFetch(env, "/admin/accounts/verify-password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { ok?: boolean; account?: Account } | null;
  return body?.ok ? (body.account ?? null) : null;
}

export type RegisterResult =
  | { ok: true; account: Account }
  | { ok: false; reason: "exists" | "failed" };

// Sign-up path only. `createAccount` is get-or-create by email because provisioning needs it to be,
// which is exactly wrong here: a lookup that merely failed must never look like "new account", or a
// transient error hands the caller a session on someone else's account. The backend answers 409 for
// a taken email and 201 for a genuinely new one — anything else is a failure, never a login.
export async function registerAccount(
  env: VoiceAgentEnv,
  account: { email: string; password: string },
): Promise<RegisterResult> {
  const res = await voiceAgentFetch(env, "/admin/accounts", {
    method: "POST",
    body: JSON.stringify(account),
  }).catch(() => null);
  if (res?.status === 409) return { ok: false, reason: "exists" };
  if (res?.status !== 201) return { ok: false, reason: "failed" };
  const created = await jsonOf<Account>(res, "account");
  return created ? { ok: true, account: created } : { ok: false, reason: "failed" };
}

export async function patchAccount(
  env: VoiceAgentEnv,
  id: string,
  update: Record<string, unknown>,
): Promise<Account | null> {
  const res = await voiceAgentFetch(env, `/admin/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  }).catch(() => null);
  return jsonOf<Account>(res, "account");
}

export async function getShop(env: VoiceAgentEnv, shopId: string): Promise<Shop | null> {
  const res = await voiceAgentFetch(env, `/admin/shops/${shopId}`).catch(() => null);
  return jsonOf<Shop>(res, "shop");
}

// The set of salons an account owns — the authority for which shop_id a signed-in client is
// allowed to act on. Anything not in this list is someone else's, so never honour it.
export async function listAccountShops(env: VoiceAgentEnv, accountId: string): Promise<Shop[]> {
  return (await listAccountShopsStrict(env, accountId)) ?? [];
}

// Financial and teardown flows must distinguish a real empty account from an unavailable API.
// Collapsing both to [] can acknowledge a Stripe cancellation while additional salons stay live,
// or incorrectly set the extra-location line item to zero.
export async function listAccountShopsStrict(
  env: VoiceAgentEnv,
  accountId: string,
): Promise<Shop[] | null> {
  const res = await voiceAgentFetch(env, `/admin/accounts/${accountId}/shops`).catch(() => null);
  return await jsonOf<Shop[]>(res, "shops");
}
