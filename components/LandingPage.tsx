import { RefCapture } from "@/components/RefCapture";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { DoneForYou } from "@/components/sections/DoneForYou";
import { Faq } from "@/components/sections/Faq";
import { Features } from "@/components/sections/Features";
import { FinalCta } from "@/components/sections/FinalCta";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { LiveDemo } from "@/components/sections/LiveDemo";
import { Nav } from "@/components/sections/Nav";
import { Pricing } from "@/components/sections/Pricing";
import { ReferralBand } from "@/components/sections/ReferralBand";
import { TrustStrip } from "@/components/sections/TrustStrip";
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
        <Hero t={t.hero} />
        <TrustStrip t={t.trust} />
        <HowItWorks t={t.how} />
        <LiveDemo t={t.demo} widget={t.widget} personas={t.personas} locale={locale} />
        <Features t={t.features} />
        <DoneForYou t={t.doneForYou} />
        <Pricing t={t.pricing} authed={authed} locale={locale} />
        <ReferralBand t={t.referralBand} locale={locale} />
        <Faq t={t.faq} />
        <FinalCta t={t.finalCta} form={t.callForm} />
      </main>
      <Footer t={t.footer} nav={t.nav} locale={locale} />
    </AuthModalProvider>
  );
}
