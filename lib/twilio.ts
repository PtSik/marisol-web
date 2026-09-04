import type { LineTypeLookup } from "@/lib/forwarding";

export interface TwilioEnv {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
}

// US E.164 → 3-digit area code (+1AAANNNNNNN or 10 raw digits).
export function usAreaCode(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return null;
}

export function toUsE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return null;
}

function auth(env: TwilioEnv): string {
  return `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`;
}

async function searchLocal(env: TwilioEnv, filter: URLSearchParams): Promise<string | null> {
  filter.set("VoiceEnabled", "true");
  filter.set("PageSize", "1");
  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}` +
    `/AvailablePhoneNumbers/US/Local.json?${filter}`;
  // A keystroke opens this request, so a hung Lookups response would hold the worker open with the
  // owner parked on "checking". carrierFromLookup already reads null as "don't guess".
  const res = await fetch(url, {
    headers: { Authorization: auth(env) },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    available_phone_numbers?: { phone_number?: string }[];
  } | null;
  return data?.available_phone_numbers?.[0]?.phone_number ?? null;
}

export interface PurchasedNumber {
  number: string;
  sid: string;
}

async function purchase(
  env: TwilioEnv,
  phoneNumber: string,
  voiceUrl: string,
): Promise<PurchasedNumber | null> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: { Authorization: auth(env), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        PhoneNumber: phoneNumber,
        VoiceUrl: voiceUrl,
        VoiceMethod: "POST",
      }),
    },
  ).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    phone_number?: string;
    sid?: string;
  } | null;
  if (!data?.phone_number || !data.sid) return null;
  return { number: data.phone_number, sid: data.sid };
}

export interface NumberSearch {
  areaCode: string | null;
  nearNumber?: string;
}

// Same area code reads as local to the caller, so it is tried first; NearNumber keeps the number
// regional once the area code is exhausted, and the unfiltered search is the last resort before we
// give up and alert a human. Purchase sits inside the loop because a candidate can be taken by
// someone else between the search and the buy.
export async function buyLocalNumber(
  env: TwilioEnv,
  search: NumberSearch,
  voiceUrl: string,
): Promise<PurchasedNumber | null> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;

  const filters: URLSearchParams[] = [];
  if (search.areaCode) filters.push(new URLSearchParams({ AreaCode: search.areaCode }));
  if (search.nearNumber) filters.push(new URLSearchParams({ NearNumber: search.nearNumber }));
  filters.push(new URLSearchParams());

  for (const filter of filters) {
    const candidate = await searchLocal(env, filter);
    if (!candidate) continue;
    const bought = await purchase(env, candidate, voiceUrl);
    if (bought) return bought;
  }
  return null;
}

export async function lookupNumberSid(env: TwilioEnv, phoneNumber: string): Promise<string | null> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}` +
    `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`;
  const res = await fetch(url, { headers: { Authorization: auth(env) } });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    incoming_phone_numbers?: { sid?: string }[];
  } | null;
  return data?.incoming_phone_numbers?.[0]?.sid ?? null;
}

// Which network a number is really on, portability included — the brand on the bill is what the
// owner would tell us, and it's often not the network whose dial codes work.
const LOOKUP_TIMEOUT_MS = 5000;

export async function lookupLineType(
  env: TwilioEnv,
  phoneNumber: string,
): Promise<LineTypeLookup | null> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneNumber)}?Fields=line_type_intelligence`;
  // A keystroke opens this request, so a hung Lookups response would hold the worker open with the
  // owner parked on "checking". carrierFromLookup already reads null as "don't guess".
  const res = await fetch(url, {
    headers: { Authorization: auth(env) },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    line_type_intelligence?: {
      carrier_name?: string;
      type?: string;
      mobile_network_code?: string;
      error_code?: number | null;
    };
  } | null;
  const line = data?.line_type_intelligence;
  if (!line || line.error_code) return null;
  return {
    carrierName: line.carrier_name,
    type: line.type,
    mobileNetworkCode: line.mobile_network_code,
  };
}

export interface InboundCall {
  startedAt: string;
  endedAt: string | null;
}

// Twilio's call log is the cheapest way to learn that a demo number rang: the landing worker owns
// the account already, so nothing has to change in voice-agent to detect it. Dates come back as
// RFC 2822; `since` filters day-granularity server-side and exactly client-side.
export async function listInboundCalls(
  env: TwilioEnv,
  to: string,
  since: Date,
): Promise<InboundCall[]> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return [];
  const query = new URLSearchParams({ To: to, PageSize: "20" });
  query.set("StartTime>", since.toISOString().slice(0, 10));
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json?${query}`,
    { headers: { Authorization: auth(env) } },
  ).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json().catch(() => null)) as {
    calls?: { start_time?: string; end_time?: string | null }[];
  } | null;

  return (data?.calls ?? [])
    .map((call) => ({
      startedAt: call.start_time ? new Date(call.start_time).toISOString() : "",
      endedAt: call.end_time ? new Date(call.end_time).toISOString() : null,
    }))
    .filter((call) => call.startedAt && call.startedAt >= since.toISOString());
}

export async function releaseTwilioNumber(env: TwilioEnv, sid: string): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return;
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${sid}.json`,
    { method: "DELETE", headers: { Authorization: auth(env) } },
  ).catch(() => {});
}
