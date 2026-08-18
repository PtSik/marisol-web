import { isDashCookieValid } from "@/lib/dashAuth";

export const SALES_COOKIE = "marisol_sales";
export const SALES_REP_COOKIE = "marisol_sales_rep";

// The rep's name is an audit trail, not access control — it answers "who spoke to this shop last",
// while the queue itself is what stops two reps dialling the same lead. Typed in rather than picked
// from a list so adding a rep never needs a code change.
export function normaliseRep(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ").slice(0, 24);
  return name.length > 0 ? name : null;
}

// The name field sits above the key field, so the key gets pasted into it. Without this the secret
// ends up in the audit table and in a cookie — it happened on the first real sign-in.
export function looksLikeKey(name: string, dashKey: string | undefined): boolean {
  if (!dashKey || name.length < 8) return false;
  return dashKey.startsWith(name) || name.startsWith(dashKey);
}

export async function isSalesCookieValid(
  cookie: string | undefined,
  dashKey: string | undefined,
): Promise<boolean> {
  return isDashCookieValid(cookie, dashKey);
}

// Only the queue and a lead's own page, on this origin. Every redirect the panel performs is named
// by a form field, and a rep can be sent a link to any of them, so the shape is what is trusted —
// never the field. "//evil.com" parses as a path and is caught by the origin check, not the regex.
const SALES_PATH = /^\/sales(\/[a-z0-9-]{1,80})?$/;

export function salesReturnTo(raw: unknown, base: string): URL | null {
  if (typeof raw !== "string" || !raw.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.origin !== new URL(base).origin) return null;
  return SALES_PATH.test(url.pathname) ? url : null;
}
