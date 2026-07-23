import { type Dict, en } from "./en";
import { es } from "./es";

export type { Dict };

export type Locale = "en" | "es";

export const LOCALE_PATH: Record<Locale, string> = { en: "/", es: "/es" };

const DICTS: Record<Locale, Dict> = { en, es };

export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}
