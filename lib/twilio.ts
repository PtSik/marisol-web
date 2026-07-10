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

function auth(env: TwilioEnv): string {
  return `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`;
}

async function findAvailableLocal(env: TwilioEnv, areaCode: string): Promise<string | null> {
  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}` +
    `/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&VoiceEnabled=true&PageSize=1`;
  const res = await fetch(url, { headers: { Authorization: auth(env) } });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    available_phone_numbers?: { phone_number?: string }[];
  } | null;
  return data?.available_phone_numbers?.[0]?.phone_number ?? null;
}

export interface PurchasedNumber {
  number: string;
  sid: string;
}

export async function buyLocalNumber(
  env: TwilioEnv,
  areaCode: string,
  voiceUrl: string,
): Promise<PurchasedNumber | null> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  const candidate = await findAvailableLocal(env, areaCode);
  if (!candidate) return null;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: { Authorization: auth(env), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        PhoneNumber: candidate,
        VoiceUrl: voiceUrl,
        VoiceMethod: "POST",
      }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    phone_number?: string;
    sid?: string;
  } | null;
  if (!data?.phone_number || !data.sid) return null;
  return { number: data.phone_number, sid: data.sid };
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
