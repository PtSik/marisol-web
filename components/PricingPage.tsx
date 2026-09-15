import { RefCapture } from "@/components/RefCapture";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { Footer } from "@/components/sections/Footer";
import { Nav } from "@/components/sections/Nav";
import { Pricing } from "@/components/sections/Pricing";
import { type Locale, getDict } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";

const PRICING_PATH = "/pricing";

// Pricing left the homepage, where its three cards were the single tallest thing on a phone. On its
// own route it can be the whole page instead of a section competing with nine others — and the FAQ
// comes with it, because the questions that stop someone buying (what the trial costs, what the
// card is for, what cancelling does) are the ones asked at the price, not at the demo.
export function PricingPage({ locale, authed }: { locale: Locale; authed: boolean }) {
  const t = getDict(locale);
  const home = locale === "es" ? "/es" : "/";
  const canonical = `${SITE_URL}${locale === "es" ? "/es" : ""}${PRICING_PATH}`;

  return (
    <AuthModalProvider t={t.auth} locale={locale}>
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en" href={`${SITE_URL}/pricing`} />
      <link rel="alternate" hrefLang="es" href={`${SITE_URL}/es/pricing`} />
      <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/pricing`} />
      <RefCapture />
      <Nav
        t={t.nav}
        lang={t.lang}
        locale={locale}
        authed={authed}
        home={home}
        path={PRICING_PATH}
      />
      <main>
        <Pricing t={t.pricing} authed={authed} locale={locale} />
        <Faq t={t.faq} />
        <FinalCta t={t.finalCta} form={t.callForm} locale={locale} authed={authed} />
      </main>
      <Footer t={t.footer} nav={t.nav} locale={locale} home={home} />
    </AuthModalProvider>
  );
}
