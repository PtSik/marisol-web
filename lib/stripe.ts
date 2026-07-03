export const SESSION_ID_RE = /^cs_[a-zA-Z0-9_]{8,250}$/;

export interface StripeCheckoutSession {
  id: string;
  payment_status?: string;
  customer?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  subscription?: string | null;
  metadata?: Record<string, string>;
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
