import { RefCapture } from "@/components/RefCapture";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { ReferralCta } from "@/components/referrals/ReferralCta";
import { ReferralFaq } from "@/components/referrals/ReferralFaq";
import { ReferralHero } from "@/components/referrals/ReferralHero";
import { ReferralStats } from "@/components/referrals/ReferralStats";
import { ReferralSteps } from "@/components/referrals/ReferralSteps";
import { ReferralWhy } from "@/components/referrals/ReferralWhy";
import { Footer } from "@/components/sections/Footer";
import { Nav } from "@/components/sections/Nav";
import { type Locale, getDict } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";

const REFERRALS_PATH = "/referrals";

export function ReferralsPage({ locale, authed }: { locale: Locale; authed: boolean }) {
  const t = getDict(locale);
  const home = locale === "es" ? "/es" : "/";
  const canonical = `${SITE_URL}${locale === "es" ? "/es" : ""}${REFERRALS_PATH}`;

  return (
    <AuthModalProvider t={t.auth} locale={locale}>
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en" href={`${SITE_URL}/referrals`} />
      <link rel="alternate" hrefLang="es" href={`${SITE_URL}/es/referrals`} />
      <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/referrals`} />
      <RefCapture />
      <Nav
        t={t.nav}
        lang={t.lang}
        locale={locale}
        authed={authed}
        home={home}
        path={REFERRALS_PATH}
      />
      <main>
        <ReferralHero t={t.referralsPage} authed={authed} />
        <ReferralStats t={t.referralsPage} />
        <ReferralSteps t={t.referralsPage} />
        <ReferralWhy t={t.referralsPage} />
        <ReferralFaq t={t.referralsPage} />
        <ReferralCta t={t.referralsPage} authed={authed} />
      </main>
      <Footer t={t.footer} nav={t.nav} locale={locale} home={home} />
    </AuthModalProvider>
  );
}
