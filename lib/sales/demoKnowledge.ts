import { DEMO_SERVICES } from "@/lib/demoServices";
import type { ServiceEntry } from "@/lib/onboarding";
import { to12h, toShopServices } from "@/lib/provisioning";
import { parseDayHours } from "@/lib/sales/derive";

// What a leased demo number answers with when it is nobody's in particular. These are the values the
// five pool shops were seeded with, and `releaseNumber` has to put every one of them back — a number
// still holding the last prospect's hours, menu or street address is the same leak as one still
// holding their name.
const IDLE_SHOP_NAME = "Marisol Demo";
const IDLE_HOURS: Readonly<Record<string, string>> = { "Mon-Fri": "8am-6pm", Sat: "9am-4pm" };
const IDLE_ADDRESS = "210 Coral Way, Miami, FL 33145";

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const PLACES_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export interface EnrichmentRow {
  services: string | null;
  service_confidence: string;
  note: string | null;
}

// The lead fields a demo actually consumes. Deliberately narrower than `SalesLead` so the D1 row
// shape and this module can move independently.
export interface DemoLead {
  shop_name: string;
  // Optional, not just nullable: `assignNumber` is called with whatever the caller has, and a lead
  // row predating either column must still be able to generate a demo.
  hours?: string | null;
  address?: string | null;
}

// voice-agent's `validateHoursJson` rejects the whole PATCH on a single bad value, and a rejected
// PATCH fails the demo generation outright (assignNumber rolls the number back). So this is a local
// copy of its rule, applied before anything leaves here: an unparseable day costs us the hours, never
// the demo.
function isValidHoursValue(v: string): boolean {
  if (v === "closed") return true;
  const [open, close] = v.split("-");
  const clock = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/;
  return !!open && !!close && clock.test(open) && clock.test(close);
}

function clockFromMinutes(min: number): string {
  // Places gives us "Open 24 hours" as 0–1440, and a past-midnight close as >1440. The agent only
  // ever needs a window to offer slots inside, so both clamp into the same day rather than trying to
  // express a wrap the hours format has no room for.
  const clamped = Math.max(0, Math.min(min, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return to12h(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

// Google Places text → the `{"Mon":"9:00am-6:00pm"}` shape voice-agent stores.
//
// All-or-nothing on purpose: a partial week reads to the agent as "closed on the days we couldn't
// parse", and confidently telling an owner his own salon is shut on Saturday is worse than saying
// nothing and keeping the demo shop's generic week.
export function toShopHoursFromPlaces(
  hours: string | null | undefined,
): Record<string, string> | null {
  if (!hours?.trim()) return null;

  const out: Record<string, string> = {};
  for (let i = 0; i < PLACES_DAYS.length; i++) {
    const intervals = parseDayHours(hours, PLACES_DAYS[i]);
    if (intervals === null) return null; // day missing or unparseable

    if (intervals.length === 0) {
      out[DAY_KEYS[i]] = "closed";
      continue;
    }
    // Several ranges in a day (a lunch break) collapse to the envelope. The agent offers slots
    // inside it; a demo is not the place to model a split shift.
    const open = Math.min(...intervals.map((x) => x.open));
    const close = Math.max(...intervals.map((x) => x.close));
    if (close <= open) return null;

    const value = `${clockFromMinutes(open)}-${clockFromMinutes(close)}`;
    if (!isValidHoursValue(value)) return null;
    out[DAY_KEYS[i]] = value;
  }
  return out;
}

// Always returns a menu — never null.
//
// Falling back by *omitting* `services_json` would leave whatever the shop last held, and since
// kaijiro-voice-landing#62 that is a full researched grooming menu with prices. The agent is now told
// to read a listed price aloud rather than deflect (voice-agent#34, hard rule 8), so an omitted field
// means quoting market rates to an owner as if they were his own. Sending something explicit is the
// only way to know what he will hear.
export function demoServices(row: EnrichmentRow | null | undefined): ServiceEntry[] {
  if (row?.service_confidence === "high" && row.services) {
    try {
      const parsed = JSON.parse(row.services);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(
          (s): s is ServiceEntry =>
            !!s && typeof s === "object" && typeof s.name === "string" && !!s.name.trim(),
        );
        if (clean.length > 0) return clean;
      }
    } catch {
      // Unparseable enrichment falls through to the reviewed menu rather than failing the demo.
    }
  }
  // The pool is grooming whatever the lead is: `agentFor` branches on language only, never vertical.
  return DEMO_SERVICES.grooming;
}

export interface DemoPatchInput {
  lead: DemoLead;
  enrichment?: EnrichmentRow | null;
  lang: "en" | "es";
  agentId?: string;
}

// Everything a leased number needs to answer as this lead's salon.
//
// `services_json` and `address` are always present so the previous prospect's values cannot survive;
// `hours_json` is the one field that may be absent, because a bad value there is rejected server-side
// and takes the whole demo with it.
export function demoShopPatch({
  lead,
  enrichment,
  lang,
  agentId,
}: DemoPatchInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    name: lead.shop_name,
    primary_language: lang,
    services_json: JSON.stringify(toShopServices(demoServices(enrichment))),
    // Places gave us their real street. Left alone, the agent reads out the demo shop's Coral Way
    // address as the owner's own — a wrong answer stated with total confidence.
    address: lead.address?.trim() || null,
  };
  if (agentId) patch.elevenlabs_agent_id = agentId;

  const hours = toShopHoursFromPlaces(lead.hours);
  if (hours) patch.hours_json = JSON.stringify(hours);

  return patch;
}

// Symmetric to `demoShopPatch`: every field that one can set, this one puts back.
export const NEUTRAL_DEMO_PATCH: Readonly<Record<string, unknown>> = {
  name: IDLE_SHOP_NAME,
  primary_language: "en",
  services_json: JSON.stringify(toShopServices(DEMO_SERVICES.grooming)),
  address: IDLE_ADDRESS,
  hours_json: JSON.stringify(IDLE_HOURS),
};

// What the rep sees in /sales before dialling, so "the agent will quote a price" is never a surprise
// mid-call.
export interface DemoKnowledge {
  hours: boolean;
  address: boolean;
  servicesFromSite: boolean;
  serviceCount: number;
  note: string | null;
}

export function demoKnowledge(lead: DemoLead, enrichment?: EnrichmentRow | null): DemoKnowledge {
  const services = demoServices(enrichment);
  const fromSite = enrichment?.service_confidence === "high" && services !== DEMO_SERVICES.grooming;
  return {
    hours: toShopHoursFromPlaces(lead.hours) !== null,
    address: !!lead.address?.trim(),
    servicesFromSite: fromSite,
    serviceCount: services.length,
    note: enrichment?.note ?? null,
  };
}
