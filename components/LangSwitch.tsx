"use client";

import type { Dict, Locale } from "@/lib/i18n/dict";
import { useEffect, useRef, useState } from "react";

function useLangOptions(t: Dict["lang"], path: string, byQuery: boolean) {
  // UTM (and any other query) must survive the language switch — read after mount so the
  // server-rendered href stays valid without it.
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(window.location.search), []);

  // The marketing site switches language by path. Onboarding has no `/es` route — it carries the
  // locale as `?lang=es` — so there the switch rewrites that param and keeps the path put, which
  // also keeps the `plan`/`billing` the client picked on the pricing card.
  if (byQuery) {
    const href = (locale: Locale) => {
      const params = new URLSearchParams(query);
      if (locale === "es") params.set("lang", "es");
      else params.delete("lang");
      const qs = params.toString();
      return `${path || "/"}${qs ? `?${qs}` : ""}`;
    };
    return [
      { code: "en" as const, href: href("en"), label: t.en, aria: t.enAria },
      { code: "es" as const, href: href("es"), label: t.es, aria: t.esAria },
    ];
  }

  return [
    { code: "en" as const, href: `${path || "/"}${query}`, label: t.en, aria: t.enAria },
    { code: "es" as const, href: `/es${path}${query}`, label: t.es, aria: t.esAria },
  ];
}

function GlobeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9.25" />
      <path d="M3 12h18" />
      <path d="M12 2.75c2.3 2.5 3.45 5.58 3.45 9.25S14.3 18.75 12 21.25c-2.3-2.5-3.45-5.58-3.45-9.25S9.7 5.25 12 2.75Z" />
    </svg>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-muted-4 ${className}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function LangSwitch({
  locale,
  t,
  path = "",
  className = "",
  byQuery = false,
}: {
  locale: Locale;
  t: Dict["lang"];
  path?: string;
  className?: string;
  byQuery?: boolean;
}) {
  const options = useLangOptions(t, path, byQuery);
  const current = options.find((o) => o.code === locale) ?? options[0];

  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = () => menuRef.current?.removeAttribute("open");
    const onPointerDown = (e: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={menuRef} className={`group relative ${className}`}>
      <summary
        aria-label={t.label}
        className="flex cursor-pointer list-none items-center gap-[6px] whitespace-nowrap text-sm text-muted [&::-webkit-details-marker]:hidden"
      >
        <GlobeIcon />
        {current.label}
        <ChevronIcon className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <nav
        aria-label={t.label}
        className="absolute right-0 top-[30px] z-[70] flex min-w-[164px] flex-col rounded-2xl border border-ink/10 bg-white p-2 shadow-[0_22px_44px_-22px_rgba(36,27,20,0.45)]"
      >
        {options.map((o) => (
          <a
            key={o.code}
            href={o.href}
            hrefLang={o.code}
            aria-label={o.aria}
            aria-current={o.code === locale ? "true" : undefined}
            className={`flex min-h-[40px] items-center justify-between gap-3 rounded-[10px] px-[12px] py-2 text-[14px] no-underline ${
              o.code === locale ? "font-medium text-ink" : "text-muted"
            }`}
          >
            {o.label}
            {o.code === locale && <CheckIcon />}
          </a>
        ))}
      </nav>
    </details>
  );
}

export function LangMenuItem({
  locale,
  t,
  path = "",
  onSelect,
}: { locale: Locale; t: Dict["lang"]; path?: string; onSelect?: () => void }) {
  const options = useLangOptions(t, path, false);
  const current = options.find((o) => o.code === locale) ?? options[0];
  const rest = options.filter((o) => o.code !== current.code);

  return (
    <details className="group">
      <summary
        aria-label={t.label}
        className="flex min-h-[44px] cursor-pointer list-none items-center gap-[8px] rounded-[10px] px-[14px] py-3 text-[15px] text-muted [&::-webkit-details-marker]:hidden"
      >
        <GlobeIcon />
        {current.label}
        <ChevronIcon className="ml-auto transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <nav aria-label={t.label} className="flex flex-col">
        {rest.map((o) => (
          <a
            key={o.code}
            href={o.href}
            hrefLang={o.code}
            aria-label={o.aria}
            onClick={onSelect}
            className="flex min-h-[44px] items-center rounded-[10px] py-3 pr-[14px] pl-[37px] text-[15px] text-muted no-underline"
          >
            {o.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
