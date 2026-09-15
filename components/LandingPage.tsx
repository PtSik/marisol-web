import { RefCapture } from "@/components/RefCapture";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { DoneForYou } from "@/components/sections/DoneForYou";
import { Faq } from "@/components/sections/Faq";
import { Features } from "@/components/sections/Features";
import { FinalCta } from "@/components/sections/FinalCta";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { LiveDemo } from "@/components/sections/LiveDemo";
import { Nav } from "@/components/sections/Nav";
import { QuietHours } from "@/components/sections/QuietHours";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { WhoItsFor } from "@/components/sections/WhoItsFor";
import { type Locale, getDict } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";

export function LandingPage({ locale, authed }: { locale: Locale; authed: boolean }) {
  const t = getDict(locale);
  const canonical = locale === "es" ? `${SITE_URL}/es` : `${SITE_URL}/`;

  return (
    <AuthModalProvider t={t.auth} locale={locale}>
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en" href={`${SITE_URL}/`} />
      <link rel="alternate" hrefLang="es" href={`${SITE_URL}/es`} />
      <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/`} />
      <RefCapture />
      <Nav t={t.nav} lang={t.lang} locale={locale} authed={authed} />
      <main>
        {/* The first screen is the hero and the names under it, one flex column exactly a viewport
            tall, so the trust strip's lower border lands on the fold rather than somewhere near it.
            The hero takes the slack and its photograph stretches into whatever height that leaves,
            which is why the crop has no fixed ratio from lg up. Past 1040px of usable height the
            lock stops tracking the window: a 1440px-tall monitor asking for a full screen is
            asking for a hero the photograph cannot fill, and the difference arrives as air. */}
        <div className="lg:flex lg:min-h-[calc(100svh-var(--nav-h))] lg:flex-col 2xl:min-h-[min(calc(100svh-var(--nav-h)),1040px)]">
          <Hero t={t.hero} locale={locale} />
          <TrustStrip t={t.trust} />
        </div>
        <WhoItsFor t={t.whoFor} />
        <LiveDemo
          t={t.demo}
          widget={t.widget}
          personas={t.personas}
          locale={locale}
          authed={authed}
        />
        <QuietHours t={t.quietHours} />
        <Features t={t.features} />
        <DoneForYou t={t.doneForYou} />
        <Faq t={t.faq} />
        <FinalCta t={t.finalCta} form={t.callForm} locale={locale} authed={authed} />
      </main>
      <Footer t={t.footer} nav={t.nav} locale={locale} />
    </AuthModalProvider>
  );
}
