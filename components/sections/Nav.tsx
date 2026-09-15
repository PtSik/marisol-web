"use client";

import { LangMenuItem, LangToggle } from "@/components/LangSwitch";
import { LogoMark } from "@/components/Logo";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { type Dict, type Locale, appHref } from "@/lib/i18n/dict";
import { useEffect, useRef } from "react";

export function Nav({
  t,
  lang,
  locale,
  authed,
  home = "",
  path = "",
}: {
  t: Dict["nav"];
  lang: Dict["lang"];
  locale: Locale;
  authed: boolean;
  home?: string;
  path?: string;
}) {
  const { openSignup, openSignin } = useAuthModal();
  const prefix = locale === "es" ? "/es" : "";
  const LINKS: { href: string; label: string; current?: boolean }[] = [
    { href: `${home}#demo`, label: t.demo },
    { href: `${home}#how`, label: t.how },
    { href: `${prefix}/pricing`, label: t.pricing, current: path === "/pricing" },
    { href: `${prefix}/referrals`, label: t.referrals, current: path === "/referrals" },
  ];

  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menuRef.current?.removeAttribute("open");

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(e.target as Node)) menu.removeAttribute("open");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <>
      <nav id="top" className="shell sticky top-0 z-50 pt-[14px]">
        <div className="flex w-full items-center justify-between gap-2 rounded-[18px] border border-ink/[0.07] bg-cream/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(36,27,20,0.04),0_18px_40px_-28px_rgba(36,27,20,0.5)] supports-[backdrop-filter]:bg-offwhite/55 supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150 sm:gap-5 sm:px-5 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <a
            href={`${home}#top`}
            className="flex min-h-[44px] items-center gap-[7px] whitespace-nowrap font-display text-[17px] font-medium tracking-tight no-underline sm:text-[19px] sm:font-normal lg:justify-self-start"
          >
            <LogoMark className="h-5 w-5 shrink-0 rounded-[3.5px]" />
            Marisol
          </a>

          {/* Five items is what the row holds: at lg the Spanish labels ("Cómo funciona",
              "Iniciar sesión") are wide enough that anything looser than gap-4 wraps them onto two
              lines, so the comfortable gap only comes back at xl. Log in reads as a nav item here
              rather than an action — that keeps the right cluster down to the language toggle and
              the one button, which is what stops the row drifting left of centre. */}
          <div className="hidden items-center text-sm text-muted lg:flex lg:gap-4 xl:gap-7">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                aria-current={l.current ? "page" : undefined}
                className={`whitespace-nowrap no-underline ${l.current ? "text-ink" : ""}`}
              >
                {l.label}
              </a>
            ))}
            {!authed && (
              <button type="button" onClick={openSignin} className="whitespace-nowrap">
                {t.logIn}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 lg:justify-self-end">
            <LangToggle locale={locale} t={lang} path={path} className="hidden lg:flex" />
            <details ref={menuRef} className="relative order-2 lg:hidden">
              <summary
                aria-label={t.openMenu}
                className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-ink/[0.07] bg-cream-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] [&::-webkit-details-marker]:hidden"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="text-ink"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </summary>
              {/* Opaque on purpose: the bar above owns the page's only backdrop-filter, and a
                  filter root stops anything nested inside it from sampling what is behind — a
                  translucent menu here would show the page through unblurred. */}
              <div className="absolute right-0 top-[54px] z-[70] flex min-w-[184px] flex-col rounded-2xl border border-ink/[0.07] bg-offwhite p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_22px_44px_-22px_rgba(36,27,20,0.45)]">
                {LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={closeMenu}
                    aria-current={l.current ? "page" : undefined}
                    className="flex min-h-[44px] items-center rounded-[10px] px-[14px] py-3 t-body text-ink no-underline"
                  >
                    {l.label}
                  </a>
                ))}
                <div className="mt-1 flex flex-col border-t border-ink/10 pt-1">
                  {!authed && (
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        openSignin();
                      }}
                      className="flex min-h-[44px] items-center rounded-[10px] px-[14px] py-3 text-left t-body text-muted"
                    >
                      {t.logIn}
                    </button>
                  )}
                  <LangMenuItem locale={locale} t={lang} path={path} onSelect={closeMenu} />
                </div>
              </div>
            </details>

            {authed ? (
              <a href={appHref(locale, "/portal")} className="btn btn-sm btn-primary order-1">
                {t.dashboard}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => openSignup()}
                className="btn btn-sm btn-primary order-1"
              >
                {t.trialCta}
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
