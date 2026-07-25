"use client";

import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";
import { APP_URL } from "@/lib/site";

const CTA =
  "inline-flex min-h-[52px] items-center justify-center rounded-xl bg-cream px-[26px] py-[15px] text-base font-medium text-ink no-underline";

export function ReferralCta({ t, authed }: { t: Dict["referralsPage"]; authed: boolean }) {
  const { openSignup } = useAuthModal();

  return (
    <section className="mx-auto max-w-content px-[22px] pb-[clamp(48px,7vw,88px)]">
      <Reveal className="rounded-[24px] bg-ink px-[clamp(24px,5vw,56px)] py-[clamp(34px,5vw,56px)] text-center text-cream">
        <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(26px,4.5vw,42px)] font-light leading-[1.08] tracking-[-0.03em]">
          {t.ctaTitle}
        </h2>
        <p className="mx-auto mt-[14px] max-w-[46ch] text-[15.5px] leading-[1.55] text-cream/[0.78]">
          {t.ctaBody}
        </p>

        <div className="mt-[26px]">
          {authed ? (
            <a href={`${APP_URL}/portal/referrals`} className={CTA}>
              {t.ctaClient}
            </a>
          ) : (
            <button type="button" onClick={() => openSignup()} className={CTA}>
              {t.ctaGuest}
            </button>
          )}
        </div>

        <p className="m-0 mt-[18px] text-[13px] text-cream/60">
          <a href="/terms#referrals" className="text-cream/[0.78] underline">
            {t.termsLine}
          </a>
        </p>
      </Reveal>
    </section>
  );
}
