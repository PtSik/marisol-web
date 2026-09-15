"use client";

import { useAuthModal } from "@/components/auth/AuthModalProvider";
import type { Dict } from "@/lib/i18n/dict";
import { APP_URL } from "@/lib/site";

const PRIMARY_CTA = "btn btn-lg btn-primary";

const SECONDARY_CTA = "btn btn-lg btn-secondary";

export function ReferralHero({ t, authed }: { t: Dict["referralsPage"]; authed: boolean }) {
  const { openSignup } = useAuthModal();

  return (
    <header className="shell pb-[clamp(28px,4vw,48px)] pt-[clamp(36px,8vw,76px)] text-center">
      <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] t-eyebrow text-muted-2">
        {t.eyebrow}
      </span>
      <h1 className="mx-auto mt-[18px] max-w-[16ch] font-display t-h1 font-normal">
        {t.title.before}
        <span className="font-extrabold text-teal">{t.title.accent}</span>
        {t.title.after}
      </h1>
      <p className="mx-auto mt-[22px] max-w-[52ch] t-lead text-muted">{t.lead}</p>

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
