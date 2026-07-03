"use client";

import { LogoMark } from "@/components/Logo";
import { useEffect, useRef } from "react";

const LINKS = [
  { href: "#demo", label: "Live demo" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
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
    <nav id="top" className="sticky top-0 z-50 mx-auto max-w-shell px-[22px] pt-[14px]">
      <div className="flex w-full items-center justify-between gap-2 rounded-[18px] border border-ink/10 bg-cream/80 px-4 py-3 backdrop-blur-md sm:gap-5 sm:px-5">
        <a
          href="#top"
          className="flex items-center gap-[7px] whitespace-nowrap font-display text-[17px] font-medium tracking-tight no-underline sm:text-[19px] sm:font-normal"
        >
          <LogoMark className="hidden h-5 w-5 shrink-0 rounded-[3.5px] sm:block" />
          AI Receptionist
        </a>

        <div className="hidden items-center gap-8 text-sm text-muted md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="no-underline">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <details ref={menuRef} className="relative order-2 md:hidden">
            <summary
              aria-label="Open menu"
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
            </div>
          </details>

          <a
            href="#demo"
            className="order-1 inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-xl bg-ink px-[14px] py-[8px] text-[13px] font-medium text-cream no-underline sm:min-h-[44px] sm:px-[18px] sm:py-[11px] sm:text-sm"
          >
            Try it live
          </a>
        </div>
      </div>
    </nav>
  );
}
