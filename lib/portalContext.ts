import { getLeadIdForShop } from "@/lib/leads";
import { type PortalEnv, type Shop, getShop, listAccountShops } from "@/lib/portalApi";
import { type PortalSession, requirePortalSession, shopIdFromCookies } from "@/lib/session";

export interface PortalContext {
  session: PortalSession;
  shops: Shop[];
  activeShopId?: string;
  activeShop?: Shop;
  activeLeadId?: string;
}

// The IDOR gate: a cookie only picks a salon it can prove the account owns; anything else falls
// back to the session's own first salon, then to the first shop in the account's list.
export function pickActiveShopId(
  shops: Shop[],
  cookieShopId: string | undefined,
  fallbackShopId: string | undefined,
): string | undefined {
  const owned = new Set(shops.map((s) => s.id));
  if (cookieShopId && owned.has(cookieShopId)) return cookieShopId;
  if (fallbackShopId && owned.has(fallbackShopId)) return fallbackShopId;
  return shops[0]?.id;
}

export async function resolveAccountShops(
  env: PortalEnv,
  session: PortalSession,
  options: { includeSuspended?: boolean } = {},
): Promise<Omit<PortalContext, "session">> {
  let shops = await listAccountShops(env, session.accountId);
  // An account whose shops predate the account_id backfill, or a salon provisioned before it was
  // linked, still has its first salon on the session — keep that portal working.
  if (shops.length === 0 && session.shopId) {
    const only = await getShop(env, session.shopId);
    if (only) shops = [only];
  }

  shops = shops.filter(
    (shop) =>
      shop.status !== "cancelled" && (options.includeSuspended || shop.status !== "suspended"),
  );

  const activeShopId = pickActiveShopId(shops, await shopIdFromCookies(), session.shopId);
  const activeShop = shops.find((s) => s.id === activeShopId);

  let activeLeadId = activeShopId && activeShopId === session.shopId ? session.leadId : undefined;
  if (!activeLeadId && activeShopId) {
    activeLeadId = (await getLeadIdForShop(env.LEADS_KV, activeShopId)) ?? undefined;
  }

  return { shops, activeShopId, activeShop, activeLeadId };
}

export async function getPortalContext(
  env: PortalEnv,
  options: { allowPending?: boolean } = {},
): Promise<PortalContext> {
  const session = await requirePortalSession(env, options);
  return {
    session,
    ...(await resolveAccountShops(env, session, { includeSuspended: options.allowPending })),
  };
}
