import type { Locale } from "@/lib/i18n/dict";
import type { BusinessBasics, SetupDetails } from "@/lib/onboarding";
import { type Billing, type Plan, normalizePlan } from "@/lib/plans";

export type LeadStatus =
  | "created"
  | "paid"
  | "setup_complete"
  | "pending_review"
  | "activating"
  | "activation_failed"
  | "provisioned"
  | "cancellation_pending"
  | "cancelled";

export const ACTIVATABLE_LEAD_STATUSES: ReadonlySet<LeadStatus> = new Set([
  "setup_complete",
  "pending_review",
  "activation_failed",
]);

export function checkoutCompletionCanAdvance(status: LeadStatus): boolean {
  return status === "created";
}

export function isWaitingForActivation(status: LeadStatus): boolean {
  return (
    status === "setup_complete" ||
    status === "pending_review" ||
    status === "activating" ||
    status === "activation_failed"
  );
}

export function isDashboardLocked(status: LeadStatus): boolean {
  return (
    status === "paid" ||
    status === "setup_complete" ||
    status === "pending_review" ||
    status === "activating" ||
    status === "activation_failed" ||
    status === "cancellation_pending" ||
    status === "cancelled"
  );
}

export function isCancellationState(status: LeadStatus): boolean {
  return status === "cancellation_pending" || status === "cancelled";
}

export interface CheckoutLead {
  id: string;
  createdAt: string;
  intent: "checkout";
  /* optional: leads created before the paid tiers have no plan */
  plan?: Plan;
  billing: Billing;
  /* the funnel language the client came in with; leads created before /es onboarding have none */
  locale?: Locale;
  basics: BusinessBasics;
  status: LeadStatus;
  /* an extra salon added from the portal: it skips checkout and joins an existing account */
  additionalLocation?: boolean;
  /* the account this salon belongs to — set for additional locations so provisioning attaches
     the shop to the owner's existing portal login instead of minting a second one */
  accountId?: string;
  stripeSessionId?: string;
  // Written before the Stripe POST. When the response or session-id write is lost, this marks an
  // attempt that may already have created a payable Checkout session.
  checkoutRequestSentAt?: string;
  checkoutAttempt?: number;
  /* Resolved Stripe promotion inputs used to decide whether an open Checkout is truly reusable. */
  checkoutReuseVersion?: 1;
  checkoutPromotionId?: string;
  checkoutReferralCode?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  paidAt?: string;
  setup?: SetupDetails;
  /* Version 2 submits the reviewed setup before payment. It is frozen for that checkout. */
  flowVersion?: 2;
  preparedAt?: string;
  readinessReviewedAt?: string;
  setupCompletedAt?: string;
  shopId?: string;
  assignedNumber?: string;
  twilioNumberSid?: string;
  provisionedAt?: string;
  provisionError?: string;
  activationStartedAt?: string;
  activationLockToken?: string;
  activationFailedAt?: string;
  /* optional neighbouring area code explicitly approved during assisted activation */
  activationAreaCodeOverride?: string;
  /* set once the client's address is a Google Cloud test user and the connect link was mailed */
  calendarEmailSentAt?: string;
  calendarAccessGrantedAt?: string;
  deprovisionedAt?: string;
  cancellationPendingAt?: string;
  /* first past_due notice; keeps every Stripe retry from re-alerting the team */
  pastDueAlertedAt?: string;
  /* checkout confirmation sent to the owner; Stripe retries must not duplicate it */
  reviewEmailSentAt?: string;
  /* referral invite went out on the first paid invoice; every later invoice must stay silent */
  referralEmailSentAt?: string;
}

export function isPreparedLead(lead: CheckoutLead): boolean {
  return (
    lead.flowVersion === 2 &&
    lead.status === "pending_review" &&
    Boolean(lead.preparedAt && lead.shopId && lead.assignedNumber && lead.twilioNumberSid) &&
    !lead.activationLockToken
  );
}

export function activationNeedsReconciliation(lead: CheckoutLead): boolean {
  if (isPreparedLead(lead)) return false;
  return Boolean(
    lead.activationStartedAt ||
      lead.activationLockToken ||
      lead.shopId ||
      lead.assignedNumber ||
      lead.twilioNumberSid,
  );
}

export function checkoutRequestMatchesLead(
  lead: CheckoutLead,
  requested: {
    plan: Plan;
    billing: Billing;
    locale: Locale;
    basics: BusinessBasics;
    setup?: SetupDetails;
    promotionId?: string;
    referralCode?: string;
  },
): boolean {
  const basicFields: ReadonlyArray<keyof BusinessBasics> = [
    "vertical",
    "businessName",
    "ownerName",
    "email",
    "businessPhone",
    "address",
    "ownerMobile",
    "timezone",
  ];
  return (
    lead.checkoutReuseVersion === 1 &&
    normalizePlan(lead.plan) === requested.plan &&
    lead.billing === requested.billing &&
    (lead.locale ?? "en") === requested.locale &&
    (lead.checkoutPromotionId ?? undefined) === requested.promotionId &&
    (lead.checkoutReferralCode ?? undefined) === requested.referralCode &&
    basicFields.every((field) => lead.basics[field] === requested.basics[field]) &&
    JSON.stringify(lead.flowVersion === 2 ? lead.setup : undefined) ===
      JSON.stringify(requested.setup)
  );
}

export interface CallLead {
  id: string;
  createdAt: string;
  intent: "call";
  call: { name: string; email: string; phone: string; preferredTime?: string; question?: string };
}

export type StoredLead = CheckoutLead | CallLead;

export const leadKey = (id: string) => `lead:${id}`;

// Reverse index: a salon's shop_id → the lead it was provisioned from. The account's first salon
// is already reachable through the session's leadId; additional salons are looked up here so every
// portal page can load the selected salon's own hours, plan and forwarding.
export const shopLeadKey = (shopId: string) => `shopLead:${shopId}`;

export async function getLeadIdForShop(
  kv: KVNamespace | undefined,
  shopId: string,
): Promise<string | null> {
  if (!kv) return null;
  try {
    return await kv.get(shopLeadKey(shopId));
  } catch {
    return null;
  }
}

export async function putLeadIdForShop(
  kv: KVNamespace | undefined,
  shopId: string,
  leadId: string,
): Promise<void> {
  if (!kv) throw new Error("LEADS_KV is not configured");
  await kv.put(shopLeadKey(shopId), leadId);
}

// Reverse index: an account → the lead that carries its subscription. Written when checkout opens,
// before any shop exists, so a client whose provisioning is still pending can be recognised as
// already paying — accounts.lead_id only lands once provisioning succeeds.
export const accountLeadKey = (accountId: string) => `accountLead:${accountId}`;

export async function getLeadIdForAccount(
  kv: KVNamespace | undefined,
  accountId: string,
): Promise<string | null> {
  if (!kv) return null;
  try {
    return await kv.get(accountLeadKey(accountId));
  } catch {
    return null;
  }
}

export async function putLeadIdForAccount(
  kv: KVNamespace | undefined,
  accountId: string,
  leadId: string,
): Promise<void> {
  if (!kv) throw new Error("LEADS_KV is not configured");
  await kv.put(accountLeadKey(accountId), leadId);
}

export async function getLead(
  kv: KVNamespace | undefined,
  id: string,
): Promise<CheckoutLead | null> {
  try {
    return await getLeadStrict(kv, id);
  } catch {
    return null;
  }
}

// Financial webhooks need to distinguish an absent lead (permanent, acknowledge after alerting)
// from a KV outage (transient, ask Stripe to retry). UI callers keep using the forgiving wrapper.
export async function getLeadStrict(
  kv: KVNamespace | undefined,
  id: string,
): Promise<CheckoutLead | null> {
  if (!kv) throw new Error("LEADS_KV is not configured");
  const lead = await kv.get<CheckoutLead>(leadKey(id), "json");
  // Leads stored before the four tiers carry "base"/"premium"; every reader wants a current plan.
  if (lead?.plan) lead.plan = normalizePlan(lead.plan);
  return lead;
}

export async function putLead(kv: KVNamespace | undefined, lead: CheckoutLead): Promise<void> {
  // A failed financial-state write must fail the request so Stripe/the client can retry. Treating it
  // as success can create a subscription or Twilio number with no durable lead pointing to it.
  if (!kv) throw new Error("LEADS_KV is not configured");
  await kv.put(leadKey(lead.id), JSON.stringify(lead));
}

export async function listLeads(kv: KVNamespace | undefined): Promise<StoredLead[]> {
  if (!kv) return [];
  try {
    const leads: StoredLead[] = [];
    let cursor: string | undefined;
    do {
      const page = await kv.list({ prefix: "lead:", cursor });
      const values = await Promise.all(page.keys.map((k) => kv.get<StoredLead>(k.name, "json")));
      for (const lead of values) if (lead) leads.push(lead);
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    leads.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return leads;
  } catch {
    return [];
  }
}
