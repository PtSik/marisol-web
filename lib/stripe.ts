export const SESSION_ID_RE = /^cs_[a-zA-Z0-9_]{8,250}$/;

export interface StripeCheckoutSession {
  id: string;
  status?: string;
  payment_status?: string;
  customer?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  subscription?: string | null;
  metadata?: Record<string, string>;
}

// A checkout that starts a free trial completes with `no_payment_required`, so payment_status
// alone cannot say the client finished. `status: "complete"` is the only value Stripe documents as
// meaning the session is done — without it a session id copied out of the Checkout URL would pass.
export function checkoutSettled(session: StripeCheckoutSession): boolean {
  if (session.status !== "complete") return false;
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

export async function getCheckoutSession(
  secretKey: string,
  sessionId: string,
): Promise<StripeCheckoutSession | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  ).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json()) as StripeCheckoutSession;
}
