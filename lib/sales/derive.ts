export type Tier = "A" | "B" | "C" | "X";
export type EsStrength = "strong" | "weak" | "none";
export type OpenState = "open" | "closed" | "unknown";

export const SHOP_TIMEZONE = "America/New_York";

// Booking systems the scraper recognises on a shop website. Having one demotes a lead but never
// excludes it — a booking page does not answer the phone.
const BOOKING_SYSTEMS = new Set([
  "booksy",
  "vagaro",
  "squire",
  "acuity",
  "square",
  "schedulicity",
  "setmore",
  "fresha",
  "moego",
  "gingr",
]);

export interface ScorableLead {
  is_mobile: boolean;
  is_chain: boolean;
  booking_app: string;
  review_count: number;
  es_strength: EsStrength;
}

// A Spanish-language Places query returns Spanish results everywhere in Miami, so `query_es` carries
// no signal at all — only the shop's own name, its website and its reviews do.
export function esStrength(languageSignal: string): EsStrength {
  if (/name_es|site_es/.test(languageSignal)) return "strong";
  if (/reviews_es/.test(languageSignal)) return "weak";
  return "none";
}

export function scoreLead(lead: ScorableLead): number {
  let score = 0;
  if (lead.is_mobile) score += 4;

  const app = lead.booking_app.trim().toLowerCase();
  if (app === "none" || app === "unknown" || app === "") score += 3;
  else if (BOOKING_SYSTEMS.has(app)) score -= 2;

  if (lead.es_strength === "strong") score += 3;
  else if (lead.es_strength === "weak") score += 2;

  if (lead.is_chain) score -= 3;
  else score += 2;

  if (lead.review_count >= 50 && lead.review_count <= 250) score += 2;
  if (lead.review_count > 800) score -= 3;

  return score;
}

// Chains and very large shops go to a collapsed group instead of the call queue: 800+ reviews means
// a front desk already answers the phone, so there is no pain to sell against.
export function tier(lead: Pick<ScorableLead, "is_chain" | "review_count">, score: number): Tier {
  if (lead.is_chain || lead.review_count > 800) return "X";
  if (score >= 9) return "A";
  if (score >= 6) return "B";
  return "C";
}

export interface HookInput {
  booking_app: string;
  is_mobile: boolean;
  review_count: number;
  es_strength: EsStrength;
}

// The one line that tells a rep why this lead is worth dialling, strongest signal first, three max.
export function hook(lead: HookInput): string {
  const parts: string[] = [];
  const app = lead.booking_app.trim().toLowerCase();
  if (app === "none") parts.push("no booking system");
  else if (BOOKING_SYSTEMS.has(app)) parts.push(`uses ${app}`);
  if (lead.is_mobile) parts.push("mobile groomer");
  if (lead.es_strength === "strong") parts.push("Spanish-speaking");
  if (lead.review_count > 0) parts.push(`${lead.review_count} reviews`);
  return parts.slice(0, 3).join(" · ");
}

// Letters NFD does not decompose, so they need spelling out; accented vowels are handled by the
// normalize + mark-strip below.
const DIACRITICS: Record<string, string> = { ø: "o", æ: "ae", ß: "ss", ł: "l", đ: "d" };

export function slugify(name: string, maxLength = 40): string {
  const lowered = name
    .toLowerCase()
    .replace(/[øæßłđ]/g, (c) => DIACRITICS[c] ?? c)
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "");
  const slug = lowered.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug;
  // Cut on a word boundary so the link stays readable in an SMS.
  const cut = slug.slice(0, maxLength + 1);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 0 ? cut.slice(0, lastDash) : slug.slice(0, maxLength)).replace(/-+$/, "");
}

// Routes that already exist in the (en) group — a shop slug must never shadow one of them.
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "es",
  "login",
  "onboarding",
  "portal",
  "privacy",
  "referrals",
  "reset-password",
  "sales",
  "terms",
  "thanks",
]);

// Later demos are disambiguated by neighbourhood, then by a counter — "Pet Supermarket" appears five
// times in the Miami grooming list.
export function uniqueSlug(name: string, neighborhood: string, taken: Set<string>): string {
  const base = slugify(name);
  const candidates = [base, slugify(`${name} ${neighborhood}`)];
  for (const candidate of candidates) {
    if (candidate && !taken.has(candidate) && !RESERVED_SLUGS.has(candidate)) return candidate;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate) && !RESERVED_SLUGS.has(candidate)) return candidate;
  }
}

export function formatUsPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return phone;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Interval {
  open: number;
  close: number;
}

function parseClock(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?[Mm]\.?$/);
  if (!match) return null;
  const hour12 = Number(match[1]);
  if (hour12 < 1 || hour12 > 12) return null;
  const minutes = Number(match[2] ?? "0");
  const isPm = match[3].toLowerCase() === "p";
  const hour = hour12 === 12 ? (isPm ? 12 : 0) : hour12 + (isPm ? 12 : 0);
  return hour * 60 + minutes;
}

// Places writes hours as "Monday: 9:00 AM – 5:00 PM | Tuesday: Closed | …", with an en dash and
// occasionally "Open 24 hours" or several ranges in one day.
export function parseDayHours(hours: string, dayName: string): Interval[] | null {
  const segment = hours
    .split("|")
    .map((s) => s.trim())
    .find((s) => s.toLowerCase().startsWith(`${dayName.toLowerCase()}:`));
  if (!segment) return null;

  const value = segment.slice(segment.indexOf(":") + 1).trim();
  if (/^closed$/i.test(value)) return [];
  if (/open 24 hours/i.test(value)) return [{ open: 0, close: 24 * 60 }];

  const intervals: Interval[] = [];
  for (const range of value.split(",")) {
    const [from, to] = range.split(/[–—-]/).map((s) => s?.trim() ?? "");
    const open = parseClock(from ?? "");
    const close = parseClock(to ?? "");
    if (open === null || close === null) continue;
    // A closing time before the opening time means the shop runs past midnight.
    intervals.push({ open, close: close <= open ? close + 24 * 60 : close });
  }
  return intervals.length > 0 ? intervals : null;
}

export function openNow(hours: string | null | undefined, now = new Date()): OpenState {
  if (!hours?.trim()) return "unknown";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIMEZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const hour = Number(get("hour")) % 24;
  const minutes = hour * 60 + Number(get("minute"));

  const today = parseDayHours(hours, weekday);
  if (today === null) return "unknown";
  if (today.some((i) => minutes >= i.open && minutes < i.close)) return "open";

  // A shop that opened yesterday evening and closes after midnight is still open right now.
  const yesterday = DAY_NAMES[(DAY_NAMES.indexOf(weekday) + 6) % 7];
  const carryOver = parseDayHours(hours, yesterday) ?? [];
  if (carryOver.some((i) => i.close > 24 * 60 && minutes < i.close - 24 * 60)) return "open";

  return "closed";
}

export interface ParsedNotes {
  rating: number | null;
  reviewCount: number | null;
  hours: string | null;
  address: string | null;
  prices: string | null;
}

// The scraper packs rating, hours, scraped prices and address into one `notes` field, and the
// segments appear in four different combinations, so each is recognised by its content rather than
// its position — relying on order silently swallowed the price segment.
export function parseNotes(notes: string): ParsedNotes {
  const parsed: ParsedNotes = {
    rating: null,
    reviewCount: null,
    hours: null,
    address: null,
    prices: null,
  };
  const leftovers: string[] = [];

  for (const segment of notes.split("·").map((s) => s.trim())) {
    if (!segment) continue;

    const rating = segment.match(/^([\d.]+)★(?:\s*(\d+)\s*reviews?)?/i);
    if (rating) {
      parsed.rating = Number(rating[1]);
      if (rating[2]) parsed.reviewCount = Number(rating[2]);
      continue;
    }
    if (DAY_NAMES.some((day) => segment.includes(`${day}:`))) {
      parsed.hours = segment;
      continue;
    }
    const prices = segment.match(/^prices:\s*(.+)$/i);
    if (prices) {
      parsed.prices = prices[1].trim();
      continue;
    }
    if (/,\s*[A-Z]{2}\b/.test(segment)) {
      parsed.address = segment;
      continue;
    }
    leftovers.push(segment);
  }

  parsed.address ??= leftovers.at(-1) ?? null;
  return parsed;
}
