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
  stripeSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  paidAt?: string;
  setup?: SetupDetails;
  setupCompletedAt?: string;
  shopId?: string;
  assignedNumber?: string;
  /* set when the client verified their identity through the Google gate after checkout */
  claimedAt?: string;
  /* the account the gate bound to this lead — its Google email may differ from the order email,
     so provisioning attaches the shop to this account instead of creating one by order email */
  claimedAccountId?: string;
  provisionedAt?: string;
  provisionError?: string;
  /* set once the client's address is a Google Cloud test user and the connect link was mailed */
  calendarEmailSentAt?: string;
  deprovisionedAt?: string;
  /* first past_due notice; keeps every Stripe retry from re-alerting the team */
  pastDueAlertedAt?: string;
}

export interface CallLead {
  id: string;
  createdAt: string;
  intent: "call";
  call: { name: string; email: string; phone: string; preferredTime?: string; question?: string };
}

export type StoredLead = CheckoutLead | CallLead;

export const leadKey = (id: string) => `lead:${id}`;

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
