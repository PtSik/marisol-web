export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^(?=(?:\D*\d){7})[+()\-.\s\d]{7,20}$/;

export const VERTICAL_IDS = ["barbershop", "grooming"] as const;

export type Vertical = (typeof VERTICAL_IDS)[number];

export interface ServiceEntry {
  name: string;
  durationMin: string;
  price: string;
}

// Names come from the dictionary (`setup.servicePresets`) so they follow the client's language.
export const SERVICE_PRESETS: Record<Vertical, Omit<ServiceEntry, "name">[]> = {
  barbershop: [
    { durationMin: "30", price: "35" },
    { durationMin: "20", price: "20" },
    { durationMin: "45", price: "50" },
  ],
  grooming: [
    { durationMin: "60", price: "45" },
    { durationMin: "90", price: "65" },
    { durationMin: "120", price: "85" },
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

export interface BusinessBasics {
  vertical: Vertical;
  businessName: string;
  ownerName: string;
  email: string;
  businessPhone: string;
  ownerMobile: string;
  timezone: string;
}

export const FORWARD_MODES = ["conditional", "all"] as const;
export type ForwardMode = (typeof FORWARD_MODES)[number];

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
  forwardMode: ForwardMode;
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

export function defaultBasics(vertical: Vertical = "barbershop"): BusinessBasics {
  return {
    vertical,
    businessName: "",
    ownerName: "",
    email: "",
    businessPhone: "",
    ownerMobile: "",
    timezone: "America/New_York",
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
    forwardMode: "conditional",
    notes: "",
  };
}

const TIME_RE = /^\d{2}:\d{2}$/;

function isShortString(value: unknown, max = 120): value is string {
  return typeof value === "string" && value.length <= max;
}

function invalidWeekHours(hours: unknown): boolean {
  if (typeof hours !== "object" || hours === null) return true;
  const week = hours as WeekHours;
  return DAYS.some((day) => {
    const h = week[day];
    if (typeof h?.closed !== "boolean" || !TIME_RE.test(h.open) || !TIME_RE.test(h.close))
      return true;
    return !h.closed && h.open >= h.close;
  });
}

// Server-side gate for anything that writes a shop's configuration — the onboarding setup
// submit and the portal's later edits go through the same rules.
export function validateSetupPayload(setup: unknown): string | null {
  if (typeof setup !== "object" || setup === null) return "invalid setup";
  const s = setup as SetupDetails;

  if (!isShortString(s.forwardNumber) || !PHONE_RE.test(s.forwardNumber))
    return "invalid forwardNumber";
  if (!FORWARD_MODES.includes(s.forwardMode)) return "invalid forwardMode";
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
        isShortString(svc?.price, 10),
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
    ["businessName", "ownerName", "email", "businessPhone", "ownerMobile", "timezone"].every(
      (key) => typeof v[key] === "string",
    )
  );
}
