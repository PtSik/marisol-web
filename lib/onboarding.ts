import { type Carrier, isCarrier } from "@/lib/forwarding";
import type { Locale } from "@/lib/i18n/dict";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^(?=(?:\D*\d){7})[+()\-.\s\d]{7,20}$/;

export const VERTICAL_IDS = ["grooming", "barbershop"] as const;

export type Vertical = (typeof VERTICAL_IDS)[number];

export interface ServiceEntry {
  name: string;
  durationMin: string;
  price: string;
  // Optional upper bounds. A grooming full groom is 60 minutes on a Yorkie and 3 hours on a matted
  // Bernedoodle, and the price moves with it — one number is always a lie for those shops. Left blank
  // (the barbershop case, and every shop onboarded before these existed) the entry stays a flat value.
  durationMaxMin?: string;
  priceMax?: string;
}

// Names come from the dictionary (`setup.servicePresets`) so they follow the client's language.
export const SERVICE_PRESETS: Record<Vertical, Omit<ServiceEntry, "name">[]> = {
  barbershop: [
    { durationMin: "30", price: "35" },
    { durationMin: "20", price: "20" },
    { durationMin: "45", price: "50" },
  ],
  // Grooming ships with ranges filled in: the spread is the point for this vertical, and a pre-filled
  // example teaches it faster than help text. A nail trim stays flat — it doesn't vary by dog.
  grooming: [
    { durationMin: "45", durationMaxMin: "75", price: "40", priceMax: "55" },
    { durationMin: "75", durationMaxMin: "120", price: "55", priceMax: "75" },
    { durationMin: "120", durationMaxMin: "210", price: "75", priceMax: "110" },
    { durationMin: "15", price: "15" },
  ],
};

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type DayId = (typeof DAYS)[number];

export interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}

export type WeekHours = Record<DayId, DayHours>;

export const TIMEZONE_IDS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
] as const;

export type TimezoneId = (typeof TIMEZONE_IDS)[number];

export const DEFAULT_TIMEZONE: TimezoneId = "America/New_York";

export function isTimezoneId(value: unknown): value is TimezoneId {
  return typeof value === "string" && TIMEZONE_IDS.some((id) => id === value);
}

// US-only: we only sell US numbers, so a zone outside the list is always a browser guess rather
// than a choice. It falls back here instead of reaching a shop row, where it would make the agent
// quote opening hours in the wrong zone.
export function coerceTimezone(value: unknown): TimezoneId {
  return isTimezoneId(value) ? value : DEFAULT_TIMEZONE;
}

export interface BusinessBasics {
  vertical: Vertical;
  businessName: string;
  ownerName: string;
  email: string;
  businessPhone: string;
  // Where the shop actually is. Callers ask this constantly and the agent used to escalate on it.
  // Optional: leads created before this field existed still validate, and the agent treats an empty
  // address as "we were never told" rather than inventing one.
  address?: string;
  ownerMobile: string;
  timezone: string;
}

export interface StaffEntry {
  // Stable across name edits — voice-agent keys per-staff config (hours, later calendars) on it.
  id: string;
  name: string;
  hours: WeekHours | null;
}

export interface SetupDetails {
  hours: WeekHours;
  services: ServiceEntry[];
  staff: StaffEntry[];
  staffCustomHours: boolean;
  calendar: "google_calendar" | "none";
  forwardNumber: string;
  // Optional: leads created before the carrier question exists still validate, and the forwarding
  // card falls back to showing both code families.
  carrier?: Carrier;
  // Optional: leads created before this question existed fall back to the funnel locale.
  // Picks the language the agent *opens* in, not the only one it speaks.
  primaryLanguage?: Locale;
  notes: string;
}

export function defaultHours(): WeekHours {
  const weekday: DayHours = { closed: false, open: "09:00", close: "18:00" };
  return {
    mon: { ...weekday },
    tue: { ...weekday },
    wed: { ...weekday },
    thu: { ...weekday },
    fri: { ...weekday },
    sat: { closed: false, open: "10:00", close: "16:00" },
    sun: { closed: true, open: "10:00", close: "16:00" },
  };
}

export function newStaffEntry(): StaffEntry {
  return { id: `stf_${crypto.randomUUID().slice(0, 8)}`, name: "", hours: null };
}

export function defaultBasics(vertical: Vertical = "grooming"): BusinessBasics {
  return {
    vertical,
    businessName: "",
    ownerName: "",
    email: "",
    businessPhone: "",
    ownerMobile: "",
    address: "",
    timezone: DEFAULT_TIMEZONE,
  };
}

export function defaultSetup(vertical: Vertical, serviceNames: readonly string[]): SetupDetails {
  return {
    hours: defaultHours(),
    services: SERVICE_PRESETS[vertical].map((s, i) => ({ ...s, name: serviceNames[i] ?? "" })),
    staff: [newStaffEntry()],
    staffCustomHours: false,
    calendar: "google_calendar",
    forwardNumber: "",
    carrier: "unknown",
    notes: "",
  };
}

const TIME_RE = /^\d{2}:\d{2}$/;

function isShortString(value: unknown, max = 120): value is string {
  return typeof value === "string" && value.length <= max;
}

// Range upper bounds are optional everywhere: a barbershop leaves them blank, and shops onboarded
// before they existed have no such key at all.
function isOptionalShortString(value: unknown, max = 120): boolean {
  return value === undefined || value === null || isShortString(value, max);
}

// Only compares when both sides are present and numeric — a blank upper bound means "no range",
// not "zero", and free text is left to the length checks above.
function aboveIsBelow(lower: unknown, upper: unknown): boolean {
  if (typeof lower !== "string" || typeof upper !== "string") return false;
  if (!lower.trim() || !upper.trim()) return false;
  const lo = Number(lower);
  const hi = Number(upper);
  return Number.isFinite(lo) && Number.isFinite(hi) && hi < lo;
}

// Shared by the browser and the worker — the form imports this rather than keeping its own copy,
// because every rule that exists on one side only turns into a bare 400 the client can't explain.
// A closed day's times are hidden in the UI, so they are never required to parse: demanding it
// there would be an error with no field to fix it in.
export function invalidWeekHours(hours: unknown): boolean {
  if (typeof hours !== "object" || hours === null) return true;
  const week = hours as WeekHours;
  return DAYS.some((day) => {
    const h = week[day];
    if (typeof h?.closed !== "boolean") return true;
    if (h.closed) return typeof h.open !== "string" || typeof h.close !== "string";
    return !TIME_RE.test(h.open) || !TIME_RE.test(h.close) || h.open >= h.close;
  });
}

// The shape the server validates. With per-person hours switched off the UI hides those fields,
// so anything still sitting in them is invisible and uneditable — it must not be able to block a
// save. Both setup forms send the normalised copy and validate that same copy.
export function normalizeSetup(setup: SetupDetails): SetupDetails {
  if (setup.staffCustomHours) return setup;
  return {
    ...setup,
    staff: setup.staff.map((m) => (m.hours === null ? m : { ...m, hours: null })),
  };
}

// Server-side gate for anything that writes a shop's configuration — the onboarding setup
// submit and the portal's later edits go through the same rules.
export function validateSetupPayload(setup: unknown): string | null {
  if (typeof setup !== "object" || setup === null) return "invalid setup";
  const s = setup as SetupDetails;

  if (!isShortString(s.forwardNumber) || !PHONE_RE.test(s.forwardNumber))
    return "invalid forwardNumber";
  if (s.carrier !== undefined && !isCarrier(s.carrier)) return "invalid carrier";
  // Guarded here rather than left to the shops CHECK constraint: without this a bad value
  // reaches provisioning and surfaces as a raw Postgres error mid-signup instead of a 400.
  if (s.primaryLanguage !== undefined && s.primaryLanguage !== "en" && s.primaryLanguage !== "es")
    return "invalid primaryLanguage";
  if (s.calendar !== "google_calendar" && s.calendar !== "none") return "invalid calendar";
  if (typeof s.notes !== "string" || s.notes.length > 2000) return "invalid notes";

  if (invalidWeekHours(s.hours)) return "invalid hours";

  if (!Array.isArray(s.services) || s.services.length === 0 || s.services.length > 30)
    return "invalid services";
  const hasService = s.services.some(
    (svc) => isShortString(svc?.name) && svc.name.trim() && Number(svc?.durationMin) > 0,
  );
  if (
    !hasService ||
    !s.services.every(
      (svc) =>
        isShortString(svc?.name) &&
        isShortString(svc?.durationMin, 5) &&
        isShortString(svc?.price, 10) &&
        isOptionalShortString(svc?.durationMaxMin, 5) &&
        isOptionalShortString(svc?.priceMax, 10),
    )
  )
    return "invalid services";
  // An upper bound below its lower bound would be spoken to callers as "ninety to sixty dollars".
  if (
    s.services.some(
      (svc) =>
        aboveIsBelow(svc?.durationMin, svc?.durationMaxMin) ||
        aboveIsBelow(svc?.price, svc?.priceMax),
    )
  )
    return "invalid services";

  if (typeof s.staffCustomHours !== "boolean") return "invalid staff";
  if (!Array.isArray(s.staff) || s.staff.length === 0 || s.staff.length > 30)
    return "invalid staff";
  if (!s.staff.some((m) => isShortString(m?.name) && m.name.trim())) return "invalid staff";
  for (const m of s.staff) {
    if (!isShortString(m?.name) || !isShortString(m?.id, 40)) return "invalid staff";
    if (m.hours === null || m.hours === undefined) continue;
    if (invalidWeekHours(m.hours)) return "invalid staff";
  }

  return null;
}

export function isBusinessBasics(value: unknown): value is BusinessBasics {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    VERTICAL_IDS.includes(v.vertical as Vertical) &&
    ["businessName", "ownerName", "email", "businessPhone", "ownerMobile"].every(
      (key) => typeof v[key] === "string",
    ) &&
    isOptionalShortString(v.address, 300) &&
    isTimezoneId(v.timezone)
  );
}
