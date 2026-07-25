import { type CheckoutLead, putLeadIdForShop } from "@/lib/leads";
import { notifyTeam, sendClientWelcome, sendProvisionAlert } from "@/lib/notify";
import type { DayId, ServiceEntry, SetupDetails, WeekHours } from "@/lib/onboarding";
import { createAccount, patchAccount } from "@/lib/portalApi";
import { createReferralPromoCode } from "@/lib/stripe";
import {
  buyLocalNumber,
  lookupNumberSid,
  releaseTwilioNumber,
  toUsE164,
  usAreaCode,
} from "@/lib/twilio";
import { type VoiceAgentEnv, voiceAgentFetch } from "@/lib/voiceAgent";

export interface ProvisioningEnv extends VoiceAgentEnv {
  LEADS_KV?: KVNamespace;
  GROOMING_AGENT_ID?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
  RESEND_FROM?: string;
  CLIENT_EMAIL_FROM?: string;
  GCAL_SHARE_EMAIL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_REFERRAL_COUPON?: string;
}

const DAY_KEY: Record<DayId, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

// voice-agent's parseTime only accepts am/pm, never 24h.
function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")}${period}`;
}

export function toShopHours(hours: WeekHours): Record<string, string> {
  const out: Record<string, string> = {};
  for (const day of Object.keys(DAY_KEY) as DayId[]) {
    const h = hours[day];
    out[DAY_KEY[day]] = h.closed ? "closed" : `${to12h(h.open)}-${to12h(h.close)}`;
  }
  return out;
}

// personalization.ts renders services_json via `array.join(', ')`, so store readable
// strings (an array of objects would render as "[object Object]").
export function toShopServices(services: ServiceEntry[]): string[] {
  return services
    .filter((s) => s.name.trim())
    .map((s) => {
      const parts = [s.name.trim()];
      const dur = s.durationMin.trim();
      const price = s.price.trim();
      if (dur) parts.push(`${dur} min`);
      if (price) parts.push(`$${price}`);
      return dur || price ? `${parts[0]} — ${parts.slice(1).join(", ")}` : parts[0];
    });
}

// staff_json carries a stable id per member so voice-agent can key per-staff config on it
// instead of the name. `hours` is only sent when the owner opted into split schedules —
// omitting it means "inherit the shop's hours" on the voice-agent side.
export function toShopStaff(setup: SetupDetails): Array<Record<string, unknown>> {
  const shopHours = JSON.stringify(toShopHours(setup.hours));
  return setup.staff
    .map((member, i) =>
      typeof member === "string" ? { id: `stf_legacy-${i}`, name: member, hours: null } : member,
    )
    .filter((m) => m.name.trim())
    .map((m) => {
      const entry: Record<string, unknown> = { id: m.id, name: m.name.trim() };
      if (setup.staffCustomHours && m.hours) {
        const own = toShopHours(m.hours);
        // Hours matching the shop's are left off so the agent isn't told about a
        // schedule that changes nothing.
        if (JSON.stringify(own) !== shopHours) entry.hours = own;
      }
      return entry;
    });
}

export function buildShopPayload(
  lead: CheckoutLead,
  twilioNumber: string,
  groomingAgentId: string | undefined,
): Record<string, unknown> {
  const { basics, setup } = lead;
  if (!setup) throw new Error("lead has no setup details");
  const payload: Record<string, unknown> = {
    name: basics.businessName,
    twilio_number: twilioNumber,
    escalation_phone: basics.ownerMobile,
    owner_escalation_phone: basics.ownerMobile,
    owner_email: basics.email,
    timezone: basics.timezone,
    hours_json: JSON.stringify(toShopHours(setup.hours)),
    services_json: JSON.stringify(toShopServices(setup.services)),
    staff_json: JSON.stringify(toShopStaff(setup)),
    integration: "none",
    status: "active",
    reminders_enabled: lead.plan === "premium",
  };
  if (basics.vertical === "grooming" && groomingAgentId) {
    payload.elevenlabs_agent_id = groomingAgentId;
  }
  return payload;
}

async function createShop(
  env: ProvisioningEnv,
  payload: Record<string, unknown>,
): Promise<{ id: string } | null> {
  const res = await voiceAgentFetch(env, "/admin/shops", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as { shop?: { id?: string } } | null;
  return data?.shop?.id ? { id: data.shop.id } : null;
}

export async function patchShop(
  env: ProvisioningEnv,
  shopId: string,
  update: Record<string, unknown>,
): Promise<boolean> {
  const res = await voiceAgentFetch(env, `/admin/shops/${shopId}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
  return res?.ok ?? false;
}

async function hmacV0(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return `v0=${Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function buildCalendarConnectUrl(
  env: ProvisioningEnv,
  shopId: string,
): Promise<string | undefined> {
  if (!env.VOICE_AGENT_API_URL || !env.ADMIN_API_KEY) return undefined;
  const sig = await hmacV0(env.ADMIN_API_KEY, `gcal-connect:${shopId}`);
  const url = new URL(`${env.VOICE_AGENT_API_URL}/integrations/google/start`);
  url.searchParams.set("shop_id", shopId);
  url.searchParams.set("sig", sig);
  return url.toString();
}

export interface ProvisionResult {
  ok: boolean;
  shopId?: string;
  number?: string;
  reason?: string;
}

// The first salon of an account: attach it to the login the client already has (created at
// registration) and mint its referral promo code. Returns the account id the shop should link to,
// or undefined if the account couldn't be created — the shop stays live regardless, so failures
// alert rather than roll back.
async function resolveFirstSalonAccount(
  env: ProvisioningEnv,
  lead: CheckoutLead,
  shopId: string,
): Promise<string | undefined> {
  // Checkout only starts for a signed-in account, so lead.accountId is set for every normal
  // first-salon lead. The create-by-email fallback covers manual /admin setups only.
  // lead_id has to be written here too: it is where a *later* login reads the subscription lead
  // from, so leaving it null blinds billing, upgrade and add-salon the moment the KV session ends.
  const account = lead.accountId
    ? await patchAccount(env, lead.accountId, { shop_id: shopId, lead_id: lead.id })
    : await createAccount(env, { email: lead.basics.email, shop_id: shopId, lead_id: lead.id });
  if (!account) {
    await notifyTeam(env, `🔑 Portal account failed: ${lead.basics.businessName}`, {
      email: lead.basics.email,
      shopId,
      leadId: lead.id,
    });
    return undefined;
  }
  // create is idempotent by email: an account that already existed came back without a shop_id.
  if (account.shop_id !== shopId) await patchAccount(env, account.id, { shop_id: shopId });

  // The promo code lets people this client refers redeem their code for 10% off. Live without it,
  // so a failure is an alert, not a rollback.
  if (env.STRIPE_SECRET_KEY && env.STRIPE_REFERRAL_COUPON) {
    const promo = await createReferralPromoCode(env.STRIPE_SECRET_KEY, {
      code: account.referral_code,
      couponId: env.STRIPE_REFERRAL_COUPON,
      accountId: account.id,
    });
    if (!promo) {
      await notifyTeam(env, `🎟️ Referral promo code failed: ${lead.basics.businessName}`, {
        email: lead.basics.email,
        referralCode: account.referral_code,
        accountId: account.id,
      });
    }
  }
  return account.id;
}

export async function provisionLead(
  env: ProvisioningEnv,
  lead: CheckoutLead,
): Promise<ProvisionResult> {
  const clientNumber = lead.setup?.forwardNumber ?? lead.basics.businessPhone;
  const areaCode = usAreaCode(clientNumber);
  if (!areaCode) {
    await sendProvisionAlert(env, lead, "cannot determine US area code from forwarding number");
    return { ok: false, reason: "invalid area code" };
  }

  const voiceUrl = `${env.VOICE_AGENT_API_URL}/twilio/inbound`;
  const bought = await buyLocalNumber(
    env,
    { areaCode, nearNumber: toUsE164(clientNumber) ?? undefined },
    voiceUrl,
  );
  if (!bought) {
    await sendProvisionAlert(
      env,
      lead,
      `no US local number available (tried area code ${areaCode})`,
    );
    return { ok: false, reason: "number purchase failed" };
  }

  try {
    const payload = buildShopPayload(lead, bought.number, env.GROOMING_AGENT_ID);
    const shop = await createShop(env, payload);
    if (!shop) {
      await releaseTwilioNumber(env, bought.sid);
      await sendProvisionAlert(env, lead, "admin POST /shops failed");
      return { ok: false, reason: "admin POST /shops failed" };
    }
    // The portal resolves a salon that isn't the account's first one through this index.
    await putLeadIdForShop(env.LEADS_KV, shop.id, lead.id);
    // An additional location joins the account that already owns this owner's other salons: never
    // a second createAccount (it would collide on accounts.email UNIQUE and split the owner across
    // two logins), never displacing the account's primary shop_id, no second referral promo.
    const accountId = lead.additionalLocation
      ? lead.accountId
      : await resolveFirstSalonAccount(env, lead, shop.id);

    // shops.account_id is the authority for "these salons are the same person" — the portal reads
    // it to list and switch between them, so every provisioned shop gets linked.
    if (accountId) await patchShop(env, shop.id, { account_id: accountId });

    const welcomed = await sendClientWelcome(env, {
      email: lead.basics.email,
      businessName: lead.basics.businessName,
      ownerName: lead.basics.ownerName,
      twilioNumber: bought.number,
      forwardMode: lead.setup?.forwardMode ?? "conditional",
    });
    // The shop is live either way, so this is an alert rather than a rollback — the client just
    // never learned their number.
    if (!welcomed) {
      await notifyTeam(env, `📪 Welcome email failed: ${lead.basics.businessName}`, {
        email: lead.basics.email,
        number: bought.number,
        shopId: shop.id,
      });
    }
    return { ok: true, shopId: shop.id, number: bought.number };
  } catch (err) {
    await releaseTwilioNumber(env, bought.sid);
    await sendProvisionAlert(env, lead, err instanceof Error ? err.message : "provisioning error");
    return { ok: false, reason: "provisioning error" };
  }
}

export interface DeprovisionResult {
  releasedNumber: boolean;
  suspendedShop: boolean;
}

export async function deprovisionLead(
  env: ProvisioningEnv,
  lead: CheckoutLead,
): Promise<DeprovisionResult> {
  let releasedNumber = false;
  if (lead.assignedNumber) {
    const sid = await lookupNumberSid(env, lead.assignedNumber);
    if (sid) {
      await releaseTwilioNumber(env, sid);
      releasedNumber = true;
    }
  }
  const suspendedShop = lead.shopId
    ? await patchShop(env, lead.shopId, { status: "cancelled" })
    : false;
  return { releasedNumber, suspendedShop };
}

// Tear down a salon we know only as a shop row — a location whose lead we can't resolve (its
// shopLead index is missing). Mirrors deprovisionLead so a shared subscription's cancellation can
// release every salon's number, not just the ones still keyed to a lead.
export async function deprovisionShop(
  env: ProvisioningEnv,
  shopId: string,
  twilioNumber?: string,
): Promise<DeprovisionResult> {
  let releasedNumber = false;
  if (twilioNumber) {
    const sid = await lookupNumberSid(env, twilioNumber);
    if (sid) {
      await releaseTwilioNumber(env, sid);
      releasedNumber = true;
    }
  }
  const suspendedShop = await patchShop(env, shopId, { status: "cancelled" });
  return { releasedNumber, suspendedShop };
}
