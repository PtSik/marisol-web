import { LogoMark } from "@/components/Logo";
import type { Dict } from "@/lib/i18n/dict";
import { DEMO_PHONE, telHref } from "@/lib/site";

export function Footer({ t, nav }: { t: Dict["footer"]; nav: Dict["nav"] }) {
  return (
    <footer className="border-t border-cream-200 bg-cream-100">
      <div className="mx-auto flex max-w-content flex-col gap-10 px-[22px] py-[clamp(34px,5vw,56px)] md:flex-row md:items-start md:justify-between">
        <div className="max-w-[34ch]">
          <div className="mb-[10px] flex items-center gap-[7px] font-display text-xl tracking-[-0.03em] sm:text-2xl">
            <LogoMark className="h-[22px] w-[22px] rounded-[4px]" />
            Marisol
          </div>
          <p className="m-0 text-[13.5px] leading-[1.55] text-muted-2">{t.tagline}</p>
          <p className="m-0 mt-2 text-[12.5px] text-muted-4">{t.byline}</p>
          <a
            href={telHref}
            className="mt-[14px] inline-block font-display text-xl tracking-[-0.02em] text-ink no-underline"
          >
            {DEMO_PHONE}
          </a>
        </div>

        <div className="flex justify-between gap-8 border-t border-cream-200 pt-9 md:justify-start md:gap-[clamp(40px,7vw,64px)] md:border-0 md:pt-0">
          <nav className="flex flex-col gap-3 text-sm text-muted" aria-label={t.product}>
            <span className="mb-[2px] text-[11.5px] uppercase tracking-[0.12em] text-muted-4">
              {t.product}
            </span>
            <a href="#demo" className="no-underline">
              {nav.demo}
            </a>
            <a href="#how" className="no-underline">
              {nav.how}
            </a>
            <a href="#pricing" className="no-underline">
              {nav.pricing}
            </a>
            <a href="#faq" className="no-underline">
              {nav.faq}
            </a>
          </nav>
          <nav className="flex flex-col gap-3 text-sm text-muted" aria-label={t.company}>
            <span className="mb-[2px] text-[11.5px] uppercase tracking-[0.12em] text-muted-4">
              {t.company}
            </span>
            <a href="/privacy" className="no-underline">
              {t.privacy}
            </a>
            <a href="/terms" className="no-underline">
              {t.terms}
            </a>
            <a href={telHref} className="no-underline">
              {t.contact}
            </a>
            <a href="/portal" className="no-underline">
              {t.portal}
            </a>
          </nav>
        </div>
      </div>

      <div className="border-t border-cream-200">
        <div className="mx-auto max-w-content px-[22px] py-[18px] text-[12.5px] text-muted-4">
          {t.copyright}
        </div>
      </div>
    </footer>
  );
}
