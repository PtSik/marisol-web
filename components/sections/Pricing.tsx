"use client";

import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { Reveal } from "@/components/motion/Reveal";
import { MultiLocationBand, PlanCards, tierCtaLabel } from "@/components/pricing/PlanCards";
import { type Dict, type Locale, appHref, fill } from "@/lib/i18n/dict";
import {
  type Billing,
  EXTRA_LOCATION_ANNUAL_TOTAL,
  EXTRA_LOCATION_PRICE,
  type Plan,
  TRIAL_DAYS,
} from "@/lib/plans";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { useState } from "react";

// The complete tier's card is ink-filled, so its button inverts; everything else is the page's
// one primary button.
const ctaCls = (tier: Plan): string =>
  tier === "complete" ? "btn btn-md btn-on-dark" : "btn btn-md btn-primary";

export function Pricing({
  t,
  authed,
  locale,
}: { t: Dict["pricing"]; authed: boolean; locale: Locale }) {
  const [billing, setBilling] = useState<Billing>("annual");
  const { openSignup } = useAuthModal();

  const renderCta = (tier: Plan) => {
    const label = tierCtaLabel(t, tier);
    if (authed) {
      return (
        <a href={appHref(locale, "/portal", { plan: tier, billing })} className={ctaCls(tier)}>
          {label}
        </a>
      );
    }
    return (
      <button type="button" onClick={() => openSignup(tier, billing)} className={ctaCls(tier)}>
        {label}
      </button>
    );
  };

  return (
    <section id="pricing" className="shell section-tight pt-[var(--section-y)]">
      <Reveal className="mb-[clamp(22px,3vw,32px)] text-center">
        <h2 className="mx-auto max-w-[40ch] font-display t-h2 font-bold text-balance">
          {t.title.before}
          <span className="whitespace-nowrap text-teal">{t.title.accent}</span>
          {t.title.after}
        </h2>
        <p className="mx-auto mt-[14px] max-w-[46ch] t-body text-muted">
          {fill(t.subtitle, { days: TRIAL_DAYS })}
        </p>
      </Reveal>

      <div className="text-center">
        <PlanCards
          t={t}
          billing={billing}
          onBillingChange={setBilling}
          renderCta={renderCta}
          detailsHref="#faq"
        />
      </div>

      <MultiLocationBand
        t={t}
        priceNote={fill(billing === "annual" ? t.extraLocationAnnualNote : t.extraLocationNote, {
          price: EXTRA_LOCATION_PRICE[billing],
          total: EXTRA_LOCATION_ANNUAL_TOTAL.toLocaleString(locale === "es" ? "es-US" : "en-US"),
        })}
        cta={
          <a href={SALES_EMAIL_HREF} className="btn btn-md btn-primary">
            {t.multiLocation.cta}
          </a>
        }
      />
    </section>
  );
}
