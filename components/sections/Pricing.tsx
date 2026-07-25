"use client";

import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { Reveal } from "@/components/motion/Reveal";
import { PlanCards } from "@/components/pricing/PlanCards";
import { type Dict, fill } from "@/lib/i18n/dict";
import { type Billing, type Plan, TRIAL_DAYS } from "@/lib/plans";
import { APP_URL, SALES_EMAIL_HREF } from "@/lib/site";
import { type ReactNode, useState } from "react";

const CTA_CLS: Record<Plan, string> = {
  base: "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-ink px-5 py-[14px] text-[15px] font-medium text-cream no-underline",
  premium:
    "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-cream px-5 py-[14px] text-[15px] font-medium text-ink no-underline",
};

function PlanCta({
  authed,
  plan,
  billing,
  className,
  children,
}: {
  authed: boolean;
  plan: Plan;
  billing: Billing;
  className: string;
  children: ReactNode;
}) {
  const { openSignup } = useAuthModal();
  if (authed) {
    return (
      <a href={`${APP_URL}/portal?plan=${plan}&billing=${billing}`} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={() => openSignup(plan, billing)} className={className}>
      {children}
    </button>
  );
}

export function Pricing({ t, authed }: { t: Dict["pricing"]; authed: boolean }) {
  const [billing, setBilling] = useState<Billing>("annual");

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
        <PlanCards
          t={t}
          billing={billing}
          onBillingChange={setBilling}
          renderCta={(plan) => (
            <PlanCta authed={authed} plan={plan} billing={billing} className={CTA_CLS[plan]}>
              {plan === "base" ? t.baseCta : t.premiumCta}
            </PlanCta>
          )}
        />
      </div>

      <p className="mt-6 text-center text-[13px] leading-[1.55] text-muted-2">
        {fill(t.trialNote, { days: TRIAL_DAYS })}
        <br />
        {t.locationsNote}
        <a href={SALES_EMAIL_HREF} className="text-ink underline">
          {t.salesLink}
        </a>
        .
      </p>
    </section>
  );
}
