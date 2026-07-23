import { RefCapture } from "@/components/RefCapture";
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
import { TrustStrip } from "@/components/sections/TrustStrip";
import { type Locale, getDict } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";

export function LandingPage({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const canonical = locale === "es" ? `${SITE_URL}/es` : `${SITE_URL}/`;

  return (
    <>
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en" href={`${SITE_URL}/`} />
      <link rel="alternate" hrefLang="es" href={`${SITE_URL}/es`} />
      <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/`} />
      <RefCapture />
      <Nav t={t.nav} lang={t.lang} locale={locale} />
      <main>
        <Hero t={t.hero} />
        <TrustStrip t={t.trust} />
        <HowItWorks t={t.how} />
        <LiveDemo t={t.demo} widget={t.widget} personas={t.personas} />
        <Features t={t.features} />
        <DoneForYou t={t.doneForYou} />
        <Pricing t={t.pricing} />
        <Faq t={t.faq} />
        <FinalCta t={t.finalCta} form={t.callForm} />
      </main>
      <Footer t={t.footer} nav={t.nav} lang={t.lang} locale={locale} />
    </>
  );
}
