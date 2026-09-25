import { type CheckoutLead, putLeadIdForShop } from "@/lib/leads";
import { notifyTeam, sendClientWelcome, sendProvisionAlert } from "@/lib/notify";
import {
  type DayId,
  type ServiceEntry,
  type SetupDetails,
  type WeekHours,
  coerceTimezone,
  openingLanguage,
} from "@/lib/onboarding";
import { normalizePlan } from "@/lib/plans";
import { type Account, createAccount, patchAccount } from "@/lib/portalApi";
import { createReferralPromoCode } from "@/lib/stripe";
import {
  buyLocalNumber,
  isUsAreaCode,
  lookupNumberSid,
  releaseTwilioNumber,
  toUsE164,
  usAreaCode,
} from "@/lib/twilio";
import { type VoiceAgentEnv, voiceAgentFetch } from "@/lib/voiceAgent";

export interface ProvisioningEnv extends VoiceAgentEnv {
  LEADS_KV?: KVNamespace;
  GROOMING_AGENT_ID?: string;
  BARBER_AGENT_ID?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
  RESEND_FROM?: string;
  CLIENT_EMAIL_FROM?: string;
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

// The shop's only record of what it sells. voice-agent books the top of a spread and reads the
// whole range out to the caller, so both bounds ship — an upper bound equal to the lower one, or
// left blank by a barbershop, simply renders as a single number.
export function toServiceCatalog(setup: SetupDetails) {
  return setup.services
    .filter((s) => s.name.trim())
    .map((s) => {
      const entry: Record<string, unknown> = {
        name: s.name.trim(),
        duration_minutes: Number(s.durationMin),
      };
      const durationMax = upper(s.durationMin, s.durationMaxMin);
      if (durationMax !== undefined) entry.duration_max_minutes = durationMax;
      const price = num(s.price);
      if (price !== undefined) {
        entry.price = price;
        const priceMax = upper(s.price, s.priceMax);
        if (priceMax !== undefined) entry.price_max = priceMax;
      }
      return entry;
    });
}

function num(value: string | undefined): number | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// An upper bound is only worth sending when the owner gave one and it is above the lower bound.
function upper(lower: string, value: string | undefined): number | undefined {
  const hi = num(value);
  const lo = num(lower);
  if (hi === undefined || lo === undefined || hi <= lo) return undefined;
  return hi;
}

export function buildShopPayload(
  lead: CheckoutLead,
  twilioNumber: string,
  agentIds: { grooming?: string; barber?: string },
): Record<string, unknown> {
  const { basics, setup } = lead;
  if (!setup) throw new Error("lead has no setup details");
  const ownerMobile = toUsE164(basics.ownerMobile);
  if (!ownerMobile) throw new Error("owner mobile is not a valid US phone number");
  const payload: Record<string, unknown> = {
    transfers_enabled: false,
    service_catalog: toServiceCatalog(setup),
    name: basics.businessName,
    twilio_number: twilioNumber,
    escalation_phone: ownerMobile,
    owner_escalation_phone: ownerMobile,
    owner_email: basics.email,
    // Last gate before the shop row: whatever the lead carries, the agent gets a zone the portal
    // can also render, so its setup stays editable.
    timezone: coerceTimezone(basics.timezone),
    hours_json: JSON.stringify(toShopHours(setup.hours)),
    staff_json: JSON.stringify(toShopStaff(setup)),
    // The agent answers "where are you?" and "do you take walk-ins?" from these. `notes` has been
    // collected by the wizard since day one — its placeholder literally says "Parking info, walk-in
    // policy…" — but it only ever reached the team notification email, never the shop row, so the
    // agent escalated on questions the owner had already answered for us.
    address: basics.address?.trim() || null,
    notes: setup.notes.trim() || null,
    // Google-selected customers are activated before OAuth, but remain booking-blocked until
    // credentials and calendar routing are saved. The voice worker uses this marker to fail closed
    // for appointment tools while still allowing the receptionist to answer calls.
    integration: setup.calendar === "google_calendar" ? "google_calendar" : "none",
    // Preparation never makes a shop callable: the operator launches it from the admin queue
    // once readiness is confirmed with the owner, so a failed run leaves nothing answering.
    status: "suspended",
    reminders_enabled: normalizePlan(lead.plan) !== "basic",
    // Which language the agent opens in. A single-language mode names it outright; a bilingual one
    // falls back to the client's pick, then to the funnel they arrived through, so an /es lead gets
    // a Spanish-first agent by default. language_detection keeps the call bilingual once running —
    // a single-language mode is not enforced downstream until the dedicated agents exist.
    primary_language: openingLanguage(setup, lead.locale ?? "en"),
  };
  // Pinned per vertical rather than left to voice-agent's ELEVENLABS_TEMPLATE_AGENT_ID fallback:
  // relying on that env var meant every non-grooming shop silently inherited the barber agent,
  // which only held while barber was the sole other vertical.
  const agentId = basics.vertical === "grooming" ? agentIds.grooming : agentIds.barber;
  if (agentId) {
    payload.elevenlabs_agent_id = agentId;
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
  env: VoiceAgentEnv,
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
  numberSid?: string;
  referralCode?: string;
  reason?: string;
  cleanupComplete?: boolean;
}

export interface ProvisioningCheckpoint {
  number: string;
  numberSid?: string;
  shopId?: string;
}

// The first salon of an account: attach it to the login the client already has (created at
// registration) and mint its referral promo code. Returns the account id the shop should link to,
// or undefined if the account couldn't be linked. Provisioning treats that as critical and rolls
// the suspended shop back before it can receive calls.
async function resolveFirstSalonAccount(
  env: ProvisioningEnv,
  lead: CheckoutLead,
  shopId: string,
): Promise<Account | undefined> {
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
  return account;
}

export async function provisionLead(
  env: ProvisioningEnv,
  lead: CheckoutLead,
  options: {
    areaCodeOverride?: string;
    checkpoint?: (resources: ProvisioningCheckpoint) => Promise<void>;
  } = {},
): Promise<ProvisionResult> {
  const clientNumber = toUsE164(lead.setup?.forwardNumber ?? lead.basics.businessPhone);
  const ownerMobile = toUsE164(lead.basics.ownerMobile);
  const clientAreaCode = clientNumber ? usAreaCode(clientNumber) : null;
  const requestedAreaCode = options.areaCodeOverride?.trim();
  if (requestedAreaCode && !isUsAreaCode(requestedAreaCode)) {
    await sendProvisionAlert(env, lead, "invalid area code override");
    return { ok: false, reason: "invalid area code override", cleanupComplete: true };
  }
  const areaCode = requestedAreaCode || clientAreaCode;
  if (!clientNumber || !areaCode || !ownerMobile) {
    const reason = !ownerMobile ? "invalid owner mobile" : "invalid forwarding number";
    await sendProvisionAlert(env, lead, reason);
    return { ok: false, reason, cleanupComplete: true };
  }
  if (!env.VOICE_AGENT_API_URL || !env.ADMIN_API_KEY) {
    await sendProvisionAlert(env, lead, "voice-agent API is not configured");
    return {
      ok: false,
      reason: "voice-agent API is not configured",
      cleanupComplete: true,
    };
  }
  const agentId = lead.basics.vertical === "grooming" ? env.GROOMING_AGENT_ID : env.BARBER_AGENT_ID;
  if (!agentId) {
    await sendProvisionAlert(env, lead, `agent id is not configured for ${lead.basics.vertical}`);
    return {
      ok: false,
      reason: `agent id is not configured for ${lead.basics.vertical}`,
      cleanupComplete: true,
    };
  }
  // Persist only canonical values into the operational payload. Existing leads can still contain
  // friendly formatting; activation normalises them at the side-effect boundary.
  lead.basics.ownerMobile = ownerMobile;
  if (lead.setup) lead.setup.forwardNumber = clientNumber;

  const voiceUrl = `${env.VOICE_AGENT_API_URL}/twilio/inbound`;
  const bought = await buyLocalNumber(
    env,
    // Assisted launch fails closed when the requested area code has no inventory. A human can agree
    // a neighbouring code with the owner; the worker must never silently buy a different state.
    { areaCode },
    voiceUrl,
  );
  if (!bought) {
    const reason = `no US local number available (tried area code ${areaCode})`;
    await sendProvisionAlert(env, lead, reason);
    return { ok: false, reason, cleanupComplete: true };
  }

  if ("uncertain" in bought) {
    await sendProvisionAlert(env, lead, `${bought.reason}; Twilio ownership needs reconciliation`);
    return {
      ok: false,
      reason: `${bought.reason}; Twilio ownership needs reconciliation`,
      cleanupComplete: false,
      number: bought.number,
      numberSid: bought.sid,
    };
  }

  let shopId: string | undefined;
  try {
    // Persist the paid resource before creating anything else. If the worker stops between steps,
    // Stripe cancellation and the admin reconciliation path can still find and release the number.
    await options.checkpoint?.({ number: bought.number, numberSid: bought.sid });
    const payload = buildShopPayload(lead, bought.number, {
      grooming: env.GROOMING_AGENT_ID,
      barber: env.BARBER_AGENT_ID,
    });
    const shop = await createShop(env, payload);
    if (!shop) {
      const released = await releaseTwilioNumber(env, bought.sid);
      await sendProvisionAlert(env, lead, "admin POST /shops failed");
      return {
        ok: false,
        reason: "admin POST /shops failed",
        cleanupComplete: released,
        ...(released ? {} : { number: bought.number, numberSid: bought.sid }),
      };
    }
    shopId = shop.id;
    // The shop starts suspended. Checkpoint its id before linking or activation so no crash can
    // leave a callable orphan that the lead/webhook does not know how to suspend.
    await options.checkpoint?.({ number: bought.number, numberSid: bought.sid, shopId: shop.id });
    // The portal resolves a salon that isn't the account's first one through this index.
    await putLeadIdForShop(env.LEADS_KV, shop.id, lead.id);
    // An additional location joins the account that already owns this owner's other salons: never
    // a second createAccount (it would collide on accounts.email UNIQUE and split the owner across
    // two logins), never displacing the account's primary shop_id, no second referral promo.
    const account = lead.additionalLocation
      ? undefined
      : await resolveFirstSalonAccount(env, lead, shop.id);
    const accountId = lead.additionalLocation ? lead.accountId : account?.id;
    if (!accountId) throw new Error("portal account link failed");

    // shops.account_id is the authority for "these salons are the same person" — the portal reads
    // it to list and switch between them, so every provisioned shop gets linked.
    if (!(await patchShop(env, shop.id, { account_id: accountId }))) {
      throw new Error("shop account link failed");
    }
    return {
      ok: true,
      shopId: shop.id,
      number: bought.number,
      numberSid: bought.sid,
      referralCode: account?.referral_code,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "provisioning error";
    const cleanup = await deprovisionLead(env, {
      ...lead,
      shopId,
      assignedNumber: bought.number,
      twilioNumberSid: bought.sid,
    });
    const { releasedNumber: released, cancelledShop } = cleanup;
    await sendProvisionAlert(
      env,
      lead,
      released && cancelledShop ? reason : `${reason}; automatic cleanup needs review`,
    );
    return {
      ok: false,
      reason: released && cancelledShop ? reason : `${reason}; cleanup needs review`,
      cleanupComplete: released && cancelledShop,
      ...(!released || !cancelledShop
        ? { shopId, number: bought.number, numberSid: bought.sid }
        : {}),
    };
  }
}

export async function sendProvisionedWelcome(
  env: ProvisioningEnv,
  lead: CheckoutLead,
  provisioned: { number?: string; shopId?: string; referralCode?: string },
): Promise<boolean> {
  if (!provisioned.number) return false;
  const welcomed = await sendClientWelcome(env, {
    email: lead.basics.email,
    businessName: lead.basics.businessName,
    ownerName: lead.basics.ownerName,
    twilioNumber: provisioned.number,
    carrier: lead.setup?.carrier,
    referralCode: provisioned.referralCode,
  });
  // The shop is live either way, so this is an alert rather than a rollback — the client just
  // never learned their number.
  if (!welcomed) {
    await notifyTeam(env, `📪 Welcome email failed: ${lead.basics.businessName}`, {
      email: lead.basics.email,
      number: provisioned.number,
      shopId: provisioned.shopId,
    });
  }
  return welcomed;
}

export interface DeprovisionResult {
  releasedNumber: boolean;
  suspendedShop: boolean;
  cancelledShop: boolean;
  complete: boolean;
}

async function releaseLeadNumber(
  env: ProvisioningEnv,
  phoneNumber: string | undefined,
  storedSid?: string,
): Promise<boolean> {
  if (!phoneNumber && !storedSid) return true;
  try {
    const sid = storedSid || (phoneNumber ? await lookupNumberSid(env, phoneNumber) : null);
    // A successful lookup with no row means the number has already been released.
    return sid ? await releaseTwilioNumber(env, sid) : true;
  } catch {
    return false;
  }
}

// `shopId: null` is a lead that never got far enough to have a shop row; it still has to release
// a number bought before the failure. An empty string is not that case — it is a lost id, and
// treating it as "no shop" would report a complete teardown that released nothing.
async function teardownSalon(
  env: ProvisioningEnv,
  salon: { shopId: string | null; twilioNumber?: string; numberSid?: string },
): Promise<DeprovisionResult> {
  if (salon.shopId === "") {
    return { releasedNumber: false, suspendedShop: false, cancelledShop: false, complete: false };
  }
  // Suspend service first. If Twilio is temporarily down the number remains attached to us, but an
  // active-only inbound gate prevents the cancelled client from continuing to use the agent.
  const suspendedShop = salon.shopId
    ? await patchShop(env, salon.shopId, { status: "suspended" })
    : true;
  // Never hand the phone number back while the shop may still be active. The voice worker's status
  // gate only protects us after this PATCH is confirmed.
  const releasedNumber = suspendedShop
    ? await releaseLeadNumber(env, salon.twilioNumber, salon.numberSid)
    : false;
  const cancelledShop =
    suspendedShop && releasedNumber && salon.shopId
      ? await patchShop(env, salon.shopId, { status: "cancelled" })
      : !salon.shopId;
  return {
    releasedNumber,
    suspendedShop,
    cancelledShop,
    complete: releasedNumber && cancelledShop,
  };
}

export async function deprovisionLead(
  env: ProvisioningEnv,
  lead: CheckoutLead,
): Promise<DeprovisionResult> {
  return teardownSalon(env, {
    shopId: lead.shopId ?? null,
    twilioNumber: lead.assignedNumber,
    numberSid: lead.twilioNumberSid,
  });
}

// Tear down a salon we know only as a shop row — a location whose lead we can't resolve (its
// shopLead index is missing), so a shared subscription's cancellation can release every salon's
// number, not just the ones still keyed to a lead. No stored SID: it lives on the lead.
export async function deprovisionShop(
  env: ProvisioningEnv,
  shopId: string,
  twilioNumber?: string,
): Promise<DeprovisionResult> {
  return teardownSalon(env, { shopId, twilioNumber });
}
