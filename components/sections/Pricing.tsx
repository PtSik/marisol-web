"use client";

import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { Reveal } from "@/components/motion/Reveal";
import { MultiLocationBand, PlanCards, tierCtaLabel } from "@/components/pricing/PlanCards";
import { type Dict, type Locale, appHref, fill } from "@/lib/i18n/dict";
import { type Billing, EXTRA_LOCATION_PRICE, type Plan, TRIAL_DAYS } from "@/lib/plans";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { useState } from "react";

const CTA_BASE =
  "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] px-5 py-[14px] text-[15px] font-medium no-underline";

const ctaCls = (tier: Plan): string =>
  tier === "complete" ? `${CTA_BASE} bg-cream text-ink` : `${CTA_BASE} bg-ink text-cream`;

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
    <section
      id="pricing"
      className="mx-auto max-w-content px-[22px] pb-[clamp(20px,3vw,40px)] pt-[clamp(48px,7vw,88px)]"
    >
      <Reveal className="mb-6 text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          {t.badge}
        </span>
        <h2 className="mx-auto mt-[18px] max-w-[18ch] font-display text-[clamp(28px,5vw,46px)] font-light leading-[1.08] tracking-[-0.03em]">
          {t.title.before}
          <span className="text-teal">{t.title.accent}</span>
          {t.title.after}
        </h2>
        <p className="mx-auto mt-[14px] max-w-[46ch] text-[15.5px] leading-[1.55] text-muted">
          {t.subtitle}
        </p>
      </Reveal>

      <div className="text-center">
        <PlanCards t={t} billing={billing} onBillingChange={setBilling} renderCta={renderCta} />
      </div>

      <p className="mt-7 text-center font-display text-[clamp(17px,2.2vw,21px)] font-light leading-[1.4] tracking-[-0.02em]">
        {t.guarantee}
      </p>

      <p className="mt-4 text-center text-[13px] leading-[1.55] text-muted-2">
        {fill(t.extraLocationNote, { price: EXTRA_LOCATION_PRICE[billing] })}
        <br />
        {fill(t.trialNote, { days: TRIAL_DAYS })}
      </p>

      <MultiLocationBand
        t={t}
        cta={
          <a href={SALES_EMAIL_HREF} className={`${CTA_BASE} bg-ink text-cream`}>
            {t.multiLocation.cta}
          </a>
        }
      />
    </section>
  );
}
