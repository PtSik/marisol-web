import type { Shop } from "@/lib/portalApi";

// Suspended locations may still be billed or need cleanup: retain their Remove action.
export function manageableSalons(shops: Shop[]): Shop[] {
  return shops.filter((shop) => shop.status !== "cancelled");
}
