import { Reveal } from "@/components/motion/Reveal";
import type { Dict, Locale } from "@/lib/i18n/dict";

export function ReferralBand({ t, locale }: { t: Dict["referralBand"]; locale: Locale }) {
  const referralsHref = locale === "es" ? "/es/referrals" : "/referrals";

  return (
    <section className="shell section-tight">
      <Reveal className="grid grid-cols-1 gap-[clamp(24px,4vw,48px)] rounded-[24px] bg-ink px-[clamp(24px,4vw,48px)] py-[clamp(28px,4vw,44px)] text-cream md:grid-cols-[1.15fr_1fr] md:items-center">
        <div>
          <h2 className="font-display t-h2 font-bold">
            {t.title.before}
            <span className="text-teal">{t.title.accent}</span>
            {t.title.after}
          </h2>
          <p className="m-0 mt-[14px] max-w-[46ch] t-body text-cream/[0.8]">{t.body}</p>
          <div className="mt-[24px] flex flex-col items-stretch gap-3 sm:flex-row">
            <a href={referralsHref} className="btn btn-md btn-on-dark">
              {t.ctaPrimary}
            </a>
            <a
              href="/terms#referrals"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-cream/25 px-[22px] py-[13px] t-body font-medium text-cream no-underline"
            >
              {t.ctaTerms}
            </a>
          </div>
        </div>

        <div>
          <dl className="m-0 flex flex-col">
            {t.specs.map((spec) => (
              <div
                key={spec.label}
                className="flex items-baseline justify-between gap-4 border-b border-cream/[0.14] py-[14px] first:pt-0"
              >
                <dt className="t-body-sm text-cream/60">{spec.label}</dt>
                <dd className="m-0 font-display t-stat font-normal tracking-[-0.02em] text-cream">
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="m-0 mt-[14px] t-caption leading-[1.5] text-cream/[0.55]">{t.note}</p>
        </div>
      </Reveal>
    </section>
  );
}
