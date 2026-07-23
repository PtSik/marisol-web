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

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}
