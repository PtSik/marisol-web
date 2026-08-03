import { type Dict, en } from "./en";
import { es } from "./es";

export type { Dict };

export type Locale = "en" | "es";

export const LOCALE_PATH: Record<Locale, string> = { en: "/", es: "/es" };

const DICTS: Record<Locale, Dict> = { en, es };

export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

export function parseLocale(value: unknown): Locale {
  return value === "es" ? "es" : "en";
}

// Onboarding has no `/es` route — the locale rides along as `?lang` until checkout stores it on the lead.
export function onboardingHref(locale: Locale, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params);
  if (locale === "es") query.set("lang", "es");
  const qs = query.toString();
  return qs ? `/onboarding?${qs}` : "/onboarding";
}

// The setup APIs answer a rejection with a machine code (`{"error":"invalid timezone"}`). Showing
// the owner "please try again" for a rule a retry can't satisfy is what turned a wrong time zone
// into a dead end, so the code is translated here and only falls back when it is one we don't know.
export function setupErrorMessage(t: Dict["setup"], code: string | undefined): string {
  const known = t.errServer as Record<string, string | undefined>;
  return (code && known[code]) || t.errSubmit;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}
