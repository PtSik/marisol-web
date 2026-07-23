"use client";

import type { Dict, Locale } from "@/lib/i18n/dict";
import { useEffect, useState } from "react";

export function LangSwitch({
  locale,
  t,
  className = "",
}: { locale: Locale; t: Dict["lang"]; className?: string }) {
  // UTM (and any other query) must survive the language switch — read after mount so the
  // server-rendered href stays valid without it.
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(window.location.search), []);

  const options = [
    { code: "en" as const, href: `/${query}`, label: t.en, aria: t.enAria },
    { code: "es" as const, href: `/es${query}`, label: t.es, aria: t.esAria },
  ];

  return (
    <nav
      aria-label={t.label}
      className={`flex items-center gap-[2px] rounded-[10px] bg-cream-200 p-[3px] ${className}`}
    >
      {options.map((o) => (
        <a
          key={o.code}
          href={o.href}
          hrefLang={o.code}
          aria-label={o.aria}
          aria-current={o.code === locale ? "true" : undefined}
          className={`inline-flex min-h-[28px] items-center justify-center rounded-[8px] px-[9px] text-[12px] font-medium no-underline ${
            o.code === locale ? "bg-ink text-cream" : "text-muted"
          }`}
        >
          {o.label}
        </a>
      ))}
    </nav>
  );
}
