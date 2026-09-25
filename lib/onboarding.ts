import { type Carrier, isCarrier } from "@/lib/forwarding";
import type { Locale } from "@/lib/i18n/dict";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^(?=(?:\D*\d){7})[+()\-.\s\d]{7,20}$/;

export function isUsPhone(value: unknown): value is string {
  if (typeof value !== "string" || !PHONE_RE.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return /^(?:1)?[2-9]\d{2}[2-9]\d{6}$/.test(digits);
}

export const VERTICAL_IDS = ["grooming", "barbershop"] as const;

export type Vertical = (typeof VERTICAL_IDS)[number];

export const LANGUAGE_MODES = ["en", "es", "bilingual"] as const;

export type LanguageMode = (typeof LANGUAGE_MODES)[number];

export function isLanguageMode(value: unknown): value is LanguageMode {
  return LANGUAGE_MODES.includes(value as LanguageMode);
}

/** The tongue the agent opens a call in, for a mode that may or may not name one itself. */
export function openingLanguage(setup: SetupDetails, fallback: Locale): Locale {
  const mode = setup.languageMode ?? "bilingual";
  if (mode !== "bilingual") return mode;
  return setup.primaryLanguage ?? fallback;
}

export interface ServiceEntry {
  name: string;
  // One number: it is the slot the receptionist reserves, and the answer to "when can I collect".
  durationMin: string;
  price: string;
  // Price alone may be a range. Nothing computes with it — it is only spoken — and a groomer cannot
  // quote one figure for a job that is $40 on a Yorkie and $55 on a matted Bernedoodle. Left blank
  // (the barbershop case) the entry reads as a flat price.
  priceMax?: string;
}

// Names come from the dictionary (`setup.servicePresets`) so they follow the client's language.
export const SERVICE_PRESETS: Record<Vertical, Omit<ServiceEntry, "name">[]> = {
  barbershop: [
    { durationMin: "30", price: "35" },
    { durationMin: "20", price: "20" },
    { durationMin: "45", price: "50" },
  ],
  // Grooming ships with price ranges filled in: the spread is the point for this vertical, and a
  // pre-filled example teaches it faster than help text. Durations are the slot to reserve, so they
  // carry the longest the job runs. A nail trim stays flat — it doesn't vary by dog.
  grooming: [
    { durationMin: "75", price: "40", priceMax: "55" },
    { durationMin: "120", price: "55", priceMax: "75" },
    { durationMin: "210", price: "75", priceMax: "110" },
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
  // Optional: leads created before this question existed are bilingual, which is what every agent
  // did when `primaryLanguage` was the only control. A single-language mode is recorded here now
  // and enforced by a dedicated ElevenLabs agent later; until then it only sets the opening tongue.
  languageMode?: LanguageMode;
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

// True only while the menu is still, row for row, this vertical's untouched example set in either
// language. That is what lets a change of vertical swap the examples out: anything the owner typed
// over is their data and outranks the switch.
export function isExampleMenu(
  services: readonly ServiceEntry[],
  vertical: Vertical,
  localizedNames: ReadonlyArray<readonly string[]>,
): boolean {
  const presets = defaultSetup(vertical, []).services;
  if (!services.length || services.length !== presets.length) return false;
  return services.every((service, index) => {
    const preset = presets[index];
    return (
      localizedNames.some((names) => names[index] === service.name) &&
      service.durationMin === preset.durationMin &&
      service.price === preset.price &&
      (service.priceMax ?? "") === (preset.priceMax ?? "")
    );
  });
}

// A draft saved while services still had a duration range carries an upper bound the model no
// longer has. Collapse it to the longest the job runs — that is the slot now reserved — rather
// than silently keeping the short end on a shop that goes live without revisiting this step.
export function collapseLegacyDurationRanges(services: ServiceEntry[]): ServiceEntry[] {
  let changed = false;
  const next = services.map((service) => {
    const { durationMaxMin, ...rest } = service as ServiceEntry & { durationMaxMin?: string };
    const upper = durationMaxMin?.trim();
    if (!upper) return service;
    changed = true;
    return { ...rest, durationMin: upper };
  });
  return changed ? next : services;
}

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

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
  // The collapse lives here, not only where a draft is restored: the portal edits a saved setup,
  // and a hidden upper bound on one would otherwise ride along into the shop untouched.
  const services = collapseLegacyDurationRanges(setup.services);
  const staff = setup.staffCustomHours
    ? setup.staff
    : setup.staff.map((m) => (m.hours === null ? m : { ...m, hours: null }));
  if (services === setup.services && staff === setup.staff) return setup;
  return { ...setup, services, staff };
}

export function isValidService(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const svc = value as ServiceEntry;
  const duration = (v: unknown) =>
    typeof v === "string" && /^\d{1,4}$/.test(v) && Number(v) >= 5 && Number(v) <= 1440;
  const price = (v: unknown) =>
    typeof v === "string" &&
    (v.trim() === "" || (/^\d{1,6}(?:\.\d{1,2})?$/.test(v) && Number(v) <= 100000));
  return (
    isShortString(svc.name) &&
    !!svc.name.trim() &&
    duration(svc.durationMin) &&
    price(svc.price) &&
    (svc.priceMax == null || price(svc.priceMax)) &&
    !(typeof svc.priceMax === "string" && svc.priceMax.trim() && !svc.price.trim()) &&
    !aboveIsBelow(svc.price, svc.priceMax)
  );
}

// Server-side gate for anything that writes a shop's configuration — the onboarding setup
// submit and the portal's later edits go through the same rules.
export function validateSetupPayload(setup: unknown): string | null {
  if (typeof setup !== "object" || setup === null) return "invalid setup";
  const s = setup as SetupDetails;

  if (!isShortString(s.forwardNumber) || !isUsPhone(s.forwardNumber))
    return "invalid forwardNumber";
  if (s.carrier !== undefined && !isCarrier(s.carrier)) return "invalid carrier";
  // Guarded here rather than left to the shops CHECK constraint: without this a bad value
  // reaches provisioning and surfaces as a raw Postgres error mid-signup instead of a 400.
  if (s.primaryLanguage !== undefined && s.primaryLanguage !== "en" && s.primaryLanguage !== "es")
    return "invalid primaryLanguage";
  if (s.languageMode !== undefined && !isLanguageMode(s.languageMode))
    return "invalid languageMode";
  if (s.calendar !== "google_calendar" && s.calendar !== "none") return "invalid calendar";
  if (typeof s.notes !== "string" || s.notes.length > 2000) return "invalid notes";

  if (invalidWeekHours(s.hours)) return "invalid hours";

  if (!Array.isArray(s.services) || s.services.length === 0 || s.services.length > 30)
    return "invalid services";
  if (!s.services.every(isValidService)) return "invalid services";
  if (new Set(s.services.map((v) => v.name.trim().toLowerCase())).size !== s.services.length)
    return "invalid services";
  // A ceiling below its floor would be spoken to callers as "ninety to sixty dollars".
  if (s.services.some((svc) => aboveIsBelow(svc?.price, svc?.priceMax))) return "invalid services";

  if (typeof s.staffCustomHours !== "boolean") return "invalid staff";
  if (!Array.isArray(s.staff) || s.staff.length === 0 || s.staff.length > 30)
    return "invalid staff";
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const m of s.staff) {
    if (!isShortString(m?.name) || !m.name.trim() || !isShortString(m?.id, 40) || !m.id.trim())
      return "invalid staff";
    const name = m.name.trim().toLocaleLowerCase();
    if (ids.has(m.id) || names.has(name)) return "invalid staff";
    ids.add(m.id);
    names.add(name);
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
