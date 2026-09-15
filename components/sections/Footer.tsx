import { LogoMark } from "@/components/Logo";
import type { Dict, Locale } from "@/lib/i18n/dict";
import { DEMO_PHONE, telHref } from "@/lib/site";

export function Footer({
  t,
  nav,
  locale,
  home = "",
}: { t: Dict["footer"]; nav: Dict["nav"]; locale: Locale; home?: string }) {
  const localeBase = locale === "es" ? "/es" : "";

  return (
    <footer className="border-t border-cream-200 bg-cream-100">
      <div className="shell flex flex-col gap-10 py-[clamp(38px,5vw,60px)] md:flex-row md:items-start md:justify-between">
        <div className="max-w-[34ch]">
          <div className="mb-[10px] flex items-center gap-[7px] font-display text-xl tracking-[-0.03em] sm:text-2xl">
            <LogoMark className="h-[22px] w-[22px] rounded-[4px]" />
            Marisol
          </div>
          <p className="m-0 t-body-sm leading-[1.55] text-muted-2">{t.tagline}</p>
          <p className="m-0 mt-2 t-caption text-muted-2">{t.byline}</p>
          <a
            href={telHref}
            className="mt-[14px] inline-block font-display text-xl tracking-[-0.02em] text-ink no-underline"
          >
            {DEMO_PHONE}
          </a>
        </div>

        <div className="flex justify-between gap-8 border-t border-cream-200 pt-9 md:justify-start md:gap-[clamp(40px,7vw,64px)] md:border-0 md:pt-0">
          <nav className="flex flex-col gap-0 text-sm text-muted md:gap-3" aria-label={t.product}>
            <span className="mb-[2px] t-eyebrow text-muted-2">{t.product}</span>
            <a
              href={`${home}#demo`}
              className="flex min-h-[44px] items-center no-underline md:min-h-0 md:block"
            >
              {nav.demo}
            </a>
            <a
              href={`${home}#how`}
              className="flex min-h-[44px] items-center no-underline md:min-h-0 md:block"
            >
              {nav.how}
            </a>
            <a
              href={`${localeBase}/pricing`}
              className="flex min-h-[44px] items-center no-underline md:min-h-0 md:block"
            >
              {nav.pricing}
            </a>
            <a
              href={`${localeBase}/referrals`}
              className="flex min-h-[44px] items-center no-underline md:min-h-0 md:block"
            >
              {nav.referrals}
            </a>
            <a
              href={`${home}#faq`}
              className="flex min-h-[44px] items-center no-underline md:min-h-0 md:block"
            >
              {nav.faq}
            </a>
          </nav>
          <nav className="flex flex-col gap-0 text-sm text-muted md:gap-3" aria-label={t.company}>
            <span className="mb-[2px] t-eyebrow text-muted-2">{t.company}</span>
            <a
              href="/privacy"
              className="flex min-h-[44px] items-center no-underline md:min-h-0 md:block"
            >
              {t.privacy}
            </a>
            <a
              href="/terms"
              className="flex min-h-[44px] items-center no-underline md:min-h-0 md:block"
            >
              {t.terms}
            </a>
            <a
              href={telHref}
              className="flex min-h-[44px] items-center no-underline md:min-h-0 md:block"
            >
              {t.contact}
            </a>
            <a
              href="/portal"
              className="flex min-h-[44px] items-center no-underline md:min-h-0 md:block"
            >
              {t.portal}
            </a>
          </nav>
        </div>
      </div>

      <div className="border-t border-cream-200">
        <div className="shell py-[18px] t-caption text-muted-2">{t.copyright}</div>
      </div>
    </footer>
  );
}
