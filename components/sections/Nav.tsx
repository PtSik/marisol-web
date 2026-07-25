"use client";

import { LangMenuItem, LangSwitch } from "@/components/LangSwitch";
import { LogoMark } from "@/components/Logo";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import type { Dict, Locale } from "@/lib/i18n/dict";
import { APP_URL } from "@/lib/site";
import { useEffect, useRef } from "react";

export function Nav({
  t,
  lang,
  locale,
  authed,
}: { t: Dict["nav"]; lang: Dict["lang"]; locale: Locale; authed: boolean }) {
  const { openSignup, openSignin } = useAuthModal();
  const LINKS = [
    { href: "#demo", label: t.demo },
    { href: "#how", label: t.how },
    { href: "#pricing", label: t.pricing },
    { href: "#faq", label: t.faq },
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
      <div className="relative z-[60] hidden justify-end px-[26px] pt-[14px] md:flex min-[1340px]:fixed min-[1340px]:inset-x-0 min-[1340px]:top-[14px] min-[1340px]:pt-0 min-[1340px]:pointer-events-none">
        <LangSwitch locale={locale} t={lang} className="pointer-events-auto" />
      </div>
      <nav
        id="top"
        className="sticky top-0 z-50 mx-auto max-w-shell px-[22px] pt-[14px] md:pt-[8px] min-[1340px]:pt-[14px]"
      >
        <div className="flex w-full items-center justify-between gap-2 rounded-[18px] border border-ink/10 bg-cream/80 px-4 py-3 backdrop-blur-md sm:gap-5 sm:px-5">
          <a
            href="#top"
            className="flex items-center gap-[7px] whitespace-nowrap font-display text-[17px] font-medium tracking-tight no-underline sm:text-[19px] sm:font-normal"
          >
            <LogoMark className="h-5 w-5 shrink-0 rounded-[3.5px]" />
            Marisol
          </a>

          <div className="hidden items-center gap-8 text-sm text-muted md:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="no-underline">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {!authed && (
              <button
                type="button"
                onClick={openSignin}
                className="order-4 hidden whitespace-nowrap px-1 text-sm text-muted md:order-none md:inline"
              >
                {t.logIn}
              </button>
            )}
            <details ref={menuRef} className="relative order-2 md:hidden">
              <summary
                aria-label={t.openMenu}
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl bg-cream-200 sm:h-11 sm:w-11 [&::-webkit-details-marker]:hidden"
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
              <div className="absolute right-0 top-[54px] z-[70] flex min-w-[184px] flex-col rounded-2xl border border-ink/10 bg-white p-2 shadow-[0_22px_44px_-22px_rgba(36,27,20,0.45)]">
                {LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={closeMenu}
                    className="flex min-h-[44px] items-center rounded-[10px] px-[14px] py-3 text-[15px] text-ink no-underline"
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
                      className="flex min-h-[44px] items-center rounded-[10px] px-[14px] py-3 text-left text-[15px] text-muted"
                    >
                      {t.logIn}
                    </button>
                  )}
                  <LangMenuItem locale={locale} t={lang} onSelect={closeMenu} />
                </div>
              </div>
            </details>

            {authed ? (
              <a
                href={`${APP_URL}/portal`}
                className="order-1 inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-xl bg-ink px-[14px] py-[8px] text-[13px] font-medium text-cream no-underline sm:min-h-[44px] sm:px-[18px] sm:py-[11px] sm:text-sm"
              >
                {t.dashboard}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => openSignup()}
                className="order-1 inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-xl bg-ink px-[14px] py-[8px] text-[13px] font-medium text-cream sm:min-h-[44px] sm:px-[18px] sm:py-[11px] sm:text-sm"
              >
                {t.getStarted}
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
