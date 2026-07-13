export const ADMIN_COOKIE = "marisol_admin";

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isAdminCookieValid(
  cookie: string | undefined,
  dashKey: string | undefined,
): Promise<boolean> {
  if (!cookie || !dashKey) return false;
  return timingSafeEqualStr(cookie, await sha256Hex(dashKey));
}
