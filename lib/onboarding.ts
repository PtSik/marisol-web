export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+()\-.\s\d]{7,20}$/;

export const VERTICALS = [
  {
    id: "barbershop",
    label: "Barbershop / salon",
    blurb: "Cuts, colour, beard work — booked by chair.",
  },
  {
    id: "grooming",
    label: "Pet grooming",
    blurb: "Baths and grooms — sized to the dog.",
  },
] as const;

export type Vertical = (typeof VERTICALS)[number]["id"];

export const VERTICAL_IDS = VERTICALS.map((v) => v.id);

export interface ServiceEntry {
  name: string;
  durationMin: string;
  price: string;
}

export const SERVICE_PRESETS: Record<Vertical, ServiceEntry[]> = {
  barbershop: [
    { name: "Haircut", durationMin: "30", price: "35" },
    { name: "Beard trim", durationMin: "20", price: "20" },
    { name: "Haircut + beard", durationMin: "45", price: "50" },
  ],
  grooming: [
    { name: "Bath & brush — small dog", durationMin: "60", price: "45" },
    { name: "Full groom — small dog", durationMin: "90", price: "65" },
    { name: "Full groom — large dog", durationMin: "120", price: "85" },
    { name: "Nail trim", durationMin: "15", price: "15" },
  ],
};

export const DAYS = [
  { id: "mon", label: "Monday" },
  { id: "tue", label: "Tuesday" },
  { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" },
  { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" },
] as const;

export type DayId = (typeof DAYS)[number]["id"];

export interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}

export type WeekHours = Record<DayId, DayHours>;

export const TIMEZONES = [
  { id: "America/New_York", label: "Eastern (ET) — Miami, New York, Atlanta" },
  { id: "America/Chicago", label: "Central (CT) — Chicago, Houston, Dallas" },
  { id: "America/Denver", label: "Mountain (MT) — Denver, Salt Lake City" },
  { id: "America/Phoenix", label: "Arizona (MST, no DST) — Phoenix, Tucson" },
  { id: "America/Los_Angeles", label: "Pacific (PT) — Los Angeles, Seattle, Las Vegas" },
  { id: "America/Anchorage", label: "Alaska (AKT) — Anchorage" },
  { id: "Pacific/Honolulu", label: "Hawaii (HST) — Honolulu" },
  { id: "America/Puerto_Rico", label: "Atlantic (AST) — San Juan, Puerto Rico" },
];

export interface OnboardingData {
  vertical: Vertical;
  businessName: string;
  ownerName: string;
  email: string;
  businessPhone: string;
  ownerMobile: string;
  timezone: string;
  hours: WeekHours;
  services: ServiceEntry[];
  staff: string[];
  calendar: "google_calendar" | "none";
  forwardNumber: string;
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

export function defaultData(vertical: Vertical = "barbershop"): OnboardingData {
  return {
    vertical,
    businessName: "",
    ownerName: "",
    email: "",
    businessPhone: "",
    ownerMobile: "",
    timezone: "America/New_York",
    hours: defaultHours(),
    services: SERVICE_PRESETS[vertical].map((s) => ({ ...s })),
    staff: [""],
    calendar: "google_calendar",
    forwardNumber: "",
    notes: "",
  };
}
