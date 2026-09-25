import { type BusinessBasics, DAYS, type ServiceEntry, type WeekHours } from "@/lib/onboarding";

export interface BusinessMatch {
  id: string;
  name: string;
  address: string | null;
}
export interface BusinessImport {
  basics: Pick<BusinessBasics, "businessName" | "businessPhone" | "address">;
  hours: WeekHours | null;
  services: ServiceEntry[];
  sourceUrl: string | null;
  researchedAt: string | null;
}

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// No demo approximations: split shifts, overnight hours, incomplete or malformed weeks
// require owner entry rather than silently broadening the appointment window.
export function importHours(raw: string | null): WeekHours | null {
  if (!raw) return null;
  const segments = raw.split("|").map((v) => v.trim());
  if (segments.length !== 7) return null;
  const result = {} as WeekHours;
  for (const [i, name] of dayNames.entries()) {
    const matching = segments.filter((v) => v.startsWith(`${name}:`));
    if (matching.length !== 1) return null;
    const value = matching[0].slice(name.length + 1).trim();
    if (/^closed$/i.test(value)) {
      result[DAYS[i]] = { closed: true, open: "09:00", close: "18:00" };
      continue;
    }
    const match = value.match(
      /^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)\s*[–—-]\s*(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$/i,
    );
    if (!match) return null;
    const clock = (h: string, m: string | undefined, ampm: string) => {
      const hour = Number(h);
      if (hour < 1 || hour > 12) return null;
      return `${String((hour % 12) + (ampm.toLowerCase() === "pm" ? 12 : 0)).padStart(2, "0")}:${m ?? "00"}`;
    };
    const open = clock(match[1], match[2], match[3]);
    const close = clock(match[4], match[5], match[6]);
    if (!open || !close || open >= close) return null;
    result[DAYS[i]] = { closed: false, open, close };
  }
  return result;
}

export function importServices(raw: string | null, confidence: string | null): ServiceEntry[] {
  if (!raw || confidence !== "high") return [];
  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return rows
    .filter((v) => v && typeof v.name === "string" && v.name.trim())
    .slice(0, 30)
    .map((v) => ({
      name: text(v.name, 120),
      durationMin: text(v.durationMin, 5),
      price: text(v.price, 10),
      priceMax: text(v.priceMax, 10),
    }));
}

export function publicWebsite(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
