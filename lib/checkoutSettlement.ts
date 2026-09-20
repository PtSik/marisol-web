import { type CheckoutLead, getLeadStrict, putLead } from "@/lib/leads";
import { validateSetupPayload } from "@/lib/onboarding";
import { type StripeCheckoutSession, checkoutSettled } from "@/lib/stripe";

export function settledLead(lead: CheckoutLead, session: StripeCheckoutSession): CheckoutLead {
  if (!checkoutSettled(session)) throw new Error("Checkout is not settled");
  if (
    session.metadata?.lead_id !== lead.id ||
    (lead.accountId && session.metadata?.account_id !== lead.accountId)
  )
    throw new Error("Checkout owner mismatch");
  if (lead.stripeSessionId && lead.stripeSessionId !== session.id)
    throw new Error("Checkout session mismatch");
  // New sessions carry the attempt that produced this frozen setup. An older completed session
  // must not settle a lead that was later reset for another checkout attempt.
  if (
    session.metadata?.checkout_attempt &&
    session.metadata.checkout_attempt !== String(lead.checkoutAttempt ?? 1)
  )
    throw new Error("Checkout attempt mismatch");
  // Delayed delivery must never undo activation, cancellation, or an operator's decision.
  if (lead.status !== "created") return lead;
  if (validateSetupPayload(lead.setup)) throw new Error("Reviewed setup is invalid");
  return {
    ...lead,
    status: "pending_review",
    paidAt: lead.paidAt ?? new Date().toISOString(),
    setupCompletedAt: lead.setupCompletedAt ?? new Date().toISOString(),
    stripeSessionId: session.id,
    ...(typeof session.customer === "string" ? { stripeCustomerId: session.customer } : {}),
    ...(typeof session.subscription === "string"
      ? { stripeSubscriptionId: session.subscription }
      : {}),
  };
}

// Shared by the verified Stripe webhook and authenticated return page. Browser return is
// optional: the webhook can queue the complete setup for review on its own.
export async function settleCheckout(
  kv: KVNamespace | undefined,
  session: StripeCheckoutSession,
): Promise<CheckoutLead> {
  const id = session.metadata?.lead_id;
  if (!id) throw new Error("Checkout has no lead");
  const lead = await getLeadStrict(kv, id);
  if (!lead) throw new Error("Checkout lead is unavailable");
  const next = settledLead(lead, session);
  if (next !== lead) await putLead(kv, next);
  return next;
}
