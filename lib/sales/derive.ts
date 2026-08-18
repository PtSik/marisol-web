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

  return score;
}

// Chains go to a collapsed group instead of the call queue: a franchise location decides nothing on
// its own, so the sale takes months and runs through a head office.
//
// Review count deliberately does NOT send a lead here any more. It used to — 800+ reviews was read
// as "a front desk already answers the phone" — but the count measures a shop's age and volume, not
// its staffing, and the two come apart exactly where our best leads are. A mobile groomer drives a
// van; there is no front desk at 200 reviews or at 2000, and the extra volume is extra missed
// calls. The rule was burying seven independent shops, three of them the strongest mobile groomers
// in Miami (Nadia at 1954 reviews, Boujee at 934, Deluxe at 871).
export function tier(lead: Pick<ScorableLead, "is_chain" | "review_count">, score: number): Tier {
  if (lead.is_chain) return "X";
  if (score >= 9) return "A";
  if (score >= 6) return "B";
  return "C";
}

export interface HookInput {
  booking_app: string;
  is_mobile: boolean;
  review_count: number;
  es_strength: EsStrength;
  hours?: ParsedWeek | null;
  website?: string | null;
}

// Below this a shop is closed more than it is open by a wide margin — the bottom quartile of the
// Broward and north-Florida lists (33% of 249 leads; the median is 48h). Anything looser stops
// separating: 48h alone would cover 57% of the list, the mistake `query_es` made.
const NARROW_HOURS_WEEKLY = 40 * 60;

/** Minutes a shop is open across the week, or `null` when Places gave us no usable hours. */
export function weeklyOpenMinutes(week: ParsedWeek | null | undefined): number | null {
  if (!week) return null;
  let total = 0;
  let parsed = false;
  for (const day of DAY_NAMES) {
    const intervals = week[day];
    if (!intervals) continue;
    parsed = true;
    for (const interval of intervals) total += interval.close - interval.open;
  }
  return parsed ? total : null;
}

// The one line that tells a rep why this lead is worth dialling, strongest signal first, three max.
//
// Hours and website lead, because they are the signals that survive outside Miami: the Spanish
// hook is 0% of the Jacksonville and St. Augustine lists and 3% of Broward, while Places gives us
// hours for 94% of leads and a quarter of them have no website at all. "closed 132h/week" is also
// the shop's own number rather than an inference, which is what makes it usable in an opener.
export function hook(lead: HookInput): string {
  const parts: string[] = [];

  const openMinutes = weeklyOpenMinutes(lead.hours);
  if (openMinutes !== null && openMinutes <= NARROW_HOURS_WEEKLY) {
    parts.push(`closed ${Math.round((7 * 24 * 60 - openMinutes) / 60)}h/week`);
  }
  // Distinct from "no booking system": a shop with no site at all has no way in but the phone.
  if (lead.website !== undefined && !lead.website?.trim()) parts.push("no website");

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

/** Opens the pin in whatever maps app the rep's phone uses, without needing coordinates. */
export const mapsHref = (address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Google's directions URL caps the waypoints between origin and destination at this many. */
const MAX_WAYPOINTS = 8;

/**
 * Turns a list of stops into one walking route, ordered as given — the route is already sorted the
 * way a rep works it, so letting Google reorder would undo that.
 *
 * `null` for fewer than two stops, a single pin being what `mapsHref` is for. Past the waypoint cap
 * the tail is dropped rather than the middle: those stops are the far end of the block, and the rep
 * gets a fresh link once the near ones are logged.
 */
export function routeHref(addresses: string[]): string | null {
  const stops = addresses.map((a) => a.trim()).filter(Boolean);
  if (stops.length < 2) return null;

  const capped = stops.slice(0, MAX_WAYPOINTS + 2);
  const params = new URLSearchParams({
    api: "1",
    travelmode: "walking",
    origin: capped[0],
    destination: capped[capped.length - 1],
  });
  const waypoints = capped.slice(1, -1);
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));

  return `https://www.google.com/maps/dir/?${params}`;
}

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayName = (typeof DAY_NAMES)[number];

const DAY_LOOKUP = new Map(DAY_NAMES.map((day) => [day.toLowerCase(), day]));

export interface Interval {
  open: number;
  close: number;
}

/**
 * Every weekday of one shop's hours, parsed once. `null` for a day Places did not list or that
 * would not parse — distinct from `[]`, which is an explicit "Closed". Keyed on the day union so a
 * partial week cannot be built by mistake; readers still guard, since a cast can defeat that.
 */
export type ParsedWeek = Readonly<Record<DayName, Interval[] | null>>;

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

function parseDayValue(value: string): Interval[] | null {
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

// Places writes hours as "Monday: 9:00 AM – 5:00 PM | Tuesday: Closed | …", with an en dash and
// occasionally "Open 24 hours" or several ranges in one day.
//
// The whole week is parsed in one pass because `openNow`, `hook` and `demoKnowledge` all want the
// same shop's hours: per-day parsing re-split and re-scanned this string 16 times per lead, which
// on its own put the /sales render over the Worker's CPU budget.
export function parseWeekHours(hours: string | null | undefined): ParsedWeek | null {
  if (!hours?.trim()) return null;

  const week: Record<DayName, Interval[] | null> = {
    Sunday: null,
    Monday: null,
    Tuesday: null,
    Wednesday: null,
    Thursday: null,
    Friday: null,
    Saturday: null,
  };

  const seen = new Set<string>();
  for (const raw of hours.split("|")) {
    const segment = raw.trim();
    const colon = segment.indexOf(":");
    if (colon < 0) continue;
    const day = DAY_LOOKUP.get(segment.slice(0, colon).toLowerCase());
    // A repeated day keeps its first segment, as the old per-day lookup did.
    if (!day || seen.has(day)) continue;
    seen.add(day);
    week[day] = parseDayValue(segment.slice(colon + 1).trim());
  }
  return week;
}

// Constructing an Intl.DateTimeFormat costs 20-90x what reusing one does, depending on the engine,
// and this runs once per lead.
const SHOP_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TIMEZONE,
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export interface ShopClock {
  weekday: DayName;
  /** Minutes since shop-local midnight. */
  minutes: number;
}

// `now` is constant across a request, so reading the clock — the expensive half of `openNow` — once
// and passing it down is what keeps a pass over every lead off the formatter.
export function shopClock(now: Date): ShopClock {
  const parts = SHOP_CLOCK.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return { weekday: get("weekday") as DayName, minutes: hour * 60 + Number(get("minute")) };
}

export function openAt(week: ParsedWeek | null | undefined, clock: ShopClock): OpenState {
  if (!week) return "unknown";

  const { weekday, minutes } = clock;

  const today = week[weekday] ?? null;
  if (today === null) return "unknown";
  if (today.some((i) => minutes >= i.open && minutes < i.close)) return "open";

  // A shop that opened yesterday evening and closes after midnight is still open right now.
  const yesterday = DAY_NAMES[(DAY_NAMES.indexOf(weekday) + 6) % 7];
  const carryOver = week[yesterday] ?? [];
  if (carryOver.some((i) => i.close > 24 * 60 && minutes < i.close - 24 * 60)) return "open";

  return "closed";
}

export function openNow(week: ParsedWeek | null | undefined, now = new Date()): OpenState {
  if (!week) return "unknown";
  return openAt(week, shopClock(now));
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
