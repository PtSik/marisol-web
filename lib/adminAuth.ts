import { isDashCookieValid } from "@/lib/dashAuth";

export { sha256Hex, timingSafeEqualStr } from "@/lib/dashAuth";

export const ADMIN_COOKIE = "marisol_admin";

export async function isAdminCookieValid(
  cookie: string | undefined,
  dashKey: string | undefined,
): Promise<boolean> {
  return isDashCookieValid(cookie, dashKey);
}
