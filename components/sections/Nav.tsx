import { LogoMark } from "@/components/Logo";

const LINKS = [
  { href: "#demo", label: "Live demo" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <nav id="top" className="sticky top-0 z-50 mx-auto max-w-shell px-[22px] pt-[14px]">
      <div className="flex w-full items-center justify-between gap-5 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
        <a
          href="#top"
          className="flex items-center gap-[7px] font-display text-[19px] tracking-tight no-underline"
        >
          <LogoMark className="h-5 w-5 rounded-[3.5px]" />
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
          <details className="relative order-2 md:hidden">
            <summary
              aria-label="Open menu"
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl bg-cream-200 [&::-webkit-details-marker]:hidden"
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
                  className="flex min-h-[44px] items-center rounded-[10px] px-[14px] py-3 text-[15px] text-ink no-underline"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </details>

          <a
            href="#demo"
            className="order-1 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-ink px-[18px] py-[11px] text-sm font-medium text-cream no-underline"
          >
            Try it live
          </a>
        </div>
      </div>
    </nav>
  );
}
