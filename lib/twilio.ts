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
  const res = await fetch(url, { headers: { Authorization: auth(env) } }).catch(() => null);
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

export async function releaseTwilioNumber(env: TwilioEnv, sid: string): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return;
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${sid}.json`,
    { method: "DELETE", headers: { Authorization: auth(env) } },
  ).catch(() => {});
}
