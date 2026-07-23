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
}

export interface Shop {
  id: string;
  name?: string;
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
  account: { email: string; shop_id?: string; lead_id?: string },
): Promise<Account | null> {
  const res = await voiceAgentFetch(env, "/admin/accounts", {
    method: "POST",
    body: JSON.stringify(account),
  }).catch(() => null);
  return jsonOf<Account>(res, "account");
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
