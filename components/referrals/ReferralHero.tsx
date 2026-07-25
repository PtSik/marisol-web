"use client";

import { useAuthModal } from "@/components/auth/AuthModalProvider";
import type { Dict } from "@/lib/i18n/dict";
import { APP_URL } from "@/lib/site";

const PRIMARY_CTA =
  "inline-flex min-h-[52px] items-center justify-center rounded-xl border border-transparent bg-ink px-[26px] py-[15px] text-base font-medium text-cream no-underline shadow-[0_12px_30px_-14px_rgba(36,27,20,0.6)]";

const SECONDARY_CTA =
  "inline-flex min-h-[52px] items-center justify-center rounded-xl border border-ink/10 bg-cream-200 px-6 py-[15px] text-base font-medium text-ink no-underline";

export function ReferralHero({ t, authed }: { t: Dict["referralsPage"]; authed: boolean }) {
  const { openSignup } = useAuthModal();

  return (
    <header className="mx-auto max-w-content px-[22px] pb-[clamp(28px,4vw,48px)] pt-[clamp(36px,8vw,76px)] text-center">
      <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
        {t.eyebrow}
      </span>
      <h1 className="mx-auto mt-[18px] max-w-[16ch] font-display text-[clamp(36px,7.6vw,70px)] font-light leading-[1.04] tracking-[-0.035em]">
        {t.title.before}
        <span className="text-teal">{t.title.accent}</span>
        {t.title.after}
      </h1>
      <p className="mx-auto mt-[22px] max-w-[52ch] text-[clamp(15.5px,2.1vw,19px)] leading-[1.55] text-muted">
        {t.lead}
      </p>

      <div className="mx-auto mt-[30px] flex w-fit flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:justify-center">
        {authed ? (
          <a href={`${APP_URL}/portal/referrals`} className={PRIMARY_CTA}>
            {t.ctaClient}
          </a>
        ) : (
          <button type="button" onClick={() => openSignup()} className={PRIMARY_CTA}>
            {t.ctaGuest}
          </button>
        )}
        <a href="/terms#referrals" className={SECONDARY_CTA}>
          {t.ctaTerms}
        </a>
      </div>
    </header>
  );
}
