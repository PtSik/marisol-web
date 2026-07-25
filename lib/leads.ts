import type { Locale } from "@/lib/i18n/dict";
import type { BusinessBasics, SetupDetails } from "@/lib/onboarding";
import type { Billing, Plan } from "@/lib/plans";

export type LeadStatus = "created" | "paid" | "setup_complete" | "provisioned" | "cancelled";

export interface CheckoutLead {
  id: string;
  createdAt: string;
  intent: "checkout";
  /* optional: leads created before the premium tier have no plan */
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
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  paidAt?: string;
  setup?: SetupDetails;
  setupCompletedAt?: string;
  shopId?: string;
  assignedNumber?: string;
  provisionedAt?: string;
  provisionError?: string;
  /* set once the client's address is a Google Cloud test user and the connect link was mailed */
  calendarEmailSentAt?: string;
  deprovisionedAt?: string;
  /* first past_due notice; keeps every Stripe retry from re-alerting the team */
  pastDueAlertedAt?: string;
  /* referral invite went out on the first paid invoice; every later invoice must stay silent */
  referralEmailSentAt?: string;
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
  await kv?.put(shopLeadKey(shopId), leadId).catch(() => {});
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
  await kv?.put(accountLeadKey(accountId), leadId).catch(() => {});
}

export async function getLead(
  kv: KVNamespace | undefined,
  id: string,
): Promise<CheckoutLead | null> {
  if (!kv) return null;
  try {
    return await kv.get<CheckoutLead>(leadKey(id), "json");
  } catch {
    return null;
  }
}

export async function putLead(kv: KVNamespace | undefined, lead: CheckoutLead): Promise<void> {
  await kv?.put(leadKey(lead.id), JSON.stringify(lead)).catch(() => {});
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
