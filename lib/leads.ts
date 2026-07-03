import type { BusinessBasics, SetupDetails } from "@/lib/onboarding";
import type { Billing } from "@/lib/plans";

export type LeadStatus = "created" | "paid" | "setup_complete";

export interface CheckoutLead {
  id: string;
  createdAt: string;
  intent: "checkout";
  billing: Billing;
  basics: BusinessBasics;
  status: LeadStatus;
  stripeSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  paidAt?: string;
  setup?: SetupDetails;
  setupCompletedAt?: string;
}

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
