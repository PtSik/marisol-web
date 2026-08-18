import type { SalesQuery } from "@/components/sales/FilterBar";
import type { Tier } from "@/lib/sales/derive";
import { type Channel, channelForArea } from "@/lib/sales/leadFilters";
import type { LeadFilters } from "@/lib/sales/leads";

// The queue opens on everything worth calling; tier X stays in its own collapsed group.
const ALL_TIERS: Tier[] = ["A", "B", "C"];

export function parseQuery(raw: Record<string, string | undefined>): SalesQuery {
  return {
    neighborhood: raw.neighborhood ?? "",
    outcome: raw.outcome === "all" ? "all" : "",
    low: raw.low === "1" ? "1" : "",
    page: raw.page ?? "",
    lowPage: raw.lowPage ?? "",
    mobile: raw.mobile === "1" ? "1" : "",
    zip: raw.zip && /^\d{1,5}$/.test(raw.zip) ? raw.zip : "",
  };
}

// How an area is worked is a property of the area, not a switch the rep flips: Stratford is walked,
// Miami is dialled. A van is dialled wherever it is parked, so the mobile list is always a call.
export function channelFor(query: SalesQuery): Channel {
  if (query.mobile === "1") return "call";
  return query.neighborhood ? channelForArea(query.neighborhood) : "call";
}

// Shared with the single-lead page, which walks the queue with Prev/Next: built from a second copy
// of these rules, its arrows would run through a different list than the one the rep came from.
export function filtersFor(query: SalesQuery, channel: Channel): LeadFilters {
  const mobile = query.mobile === "1";
  return {
    neighborhood: query.neighborhood || undefined,
    tiers: ALL_TIERS,
    outcome: query.outcome === "all" ? undefined : "queue",
    channel,
    mobile,
    zip: !mobile && channel === "walk" && query.zip ? Number(query.zip) : undefined,
  };
}
