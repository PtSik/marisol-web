export const PAYOUT_METHODS = ["paypal", "venmo", "zelle"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_LABEL: Record<PayoutMethod, string> = {
  paypal: "PayPal",
  venmo: "Venmo",
  zelle: "Zelle",
};

export const PAYOUT_HINT =
  "PayPal: your account email or paypal.me username. Venmo: your @username. Zelle: the email or phone your bank has enrolled.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s().-]{6,19}$/;
const USERNAME_RE = /^@?[A-Za-z0-9._-]{2,30}$/;

export function isPayoutMethod(value: unknown): value is PayoutMethod {
  return typeof value === "string" && (PAYOUT_METHODS as readonly string[]).includes(value);
}

// A typo here means the $200 goes nowhere, so each rail only accepts the shapes it can actually
// receive money at. Returns the trimmed handle, or null if it can't be one.
export function normalisePayoutHandle(method: PayoutMethod, raw: unknown): string | null {
  const handle = typeof raw === "string" ? raw.trim() : "";
  if (!handle) return null;
  const ok =
    method === "venmo"
      ? USERNAME_RE.test(handle) || PHONE_RE.test(handle)
      : method === "paypal"
        ? EMAIL_RE.test(handle) || USERNAME_RE.test(handle)
        : EMAIL_RE.test(handle) || PHONE_RE.test(handle);
  return ok ? handle : null;
}
