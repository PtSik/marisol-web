import { LangToggle } from "@/components/LangSwitch";
import { LogoMark } from "@/components/Logo";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LOCALE_PATH, type Locale, getDict } from "@/lib/i18n/dict";
import { siteHref } from "@/lib/site";

// The same floating glass bar the marketing site uses, so crossing from the landing into the
// funnel does not look like crossing into a different product. The wordmark is the way back to the
// site, which is why there is no separate "Back to site" link beside it.
export function FunnelNav({
  locale,
  path,
  wide = false,
  showLangSwitch = true,
  showSignOut = true,
}: {
  locale: Locale;
  path: string;
  /** Match the two-column wizard. A bar wider than the content it sits over is the reason the
   *  blur had nothing to work with in the first place. */
  wide?: boolean;
  showLangSwitch?: boolean;
  showSignOut?: boolean;
}) {
  const dict = getDict(locale);
  return (
    <nav
      className={`sticky top-0 z-50 mx-auto w-full max-w-[820px] px-[var(--gutter)] pt-[14px] ${
        wide ? "2xl:max-w-[1560px]" : ""
      }`}
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-[18px] border border-ink/[0.07] bg-cream/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(36,27,20,0.04),0_18px_40px_-28px_rgba(36,27,20,0.5)] supports-[backdrop-filter]:bg-offwhite/55 supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150 sm:px-5">
        <a
          href={siteHref(LOCALE_PATH[locale])}
          className="flex min-h-[44px] items-center gap-[7px] whitespace-nowrap font-display text-[17px] font-medium tracking-tight no-underline sm:text-[19px] sm:font-normal"
        >
          <LogoMark className="h-5 w-5 shrink-0 rounded-[3.5px]" />
          Marisol
        </a>
        <div className="flex flex-wrap items-center gap-4">
          {showLangSwitch && <LangToggle locale={locale} t={dict.lang} path={path} byQuery />}
          {showSignOut && <SignOutButton label={dict.auth.signOut} />}
        </div>
      </div>
    </nav>
  );
}
