import { Reveal } from "@/components/motion/Reveal";
import { type Dict, fill } from "@/lib/i18n/dict";
import { TRIAL_DAYS } from "@/lib/plans";

export function ReferralWhy({ t }: { t: Dict["referralsPage"] }) {
  return (
    <section className="mx-auto max-w-content px-[22px] pb-[clamp(34px,6vw,72px)]">
      <Reveal className="mb-[clamp(24px,4vw,40px)] text-center">
        <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(26px,4.5vw,42px)] font-light leading-[1.08] tracking-[-0.03em]">
          {t.whyTitle}
        </h2>
      </Reveal>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {t.why.map((card, i) => (
          <Reveal
            as="li"
            key={card.title}
            delay={i * 90}
            className="flex flex-col rounded-[20px] border border-ink/[0.07] px-[24px] py-[26px]"
          >
            <h3 className="font-display text-[20px] font-normal tracking-[-0.02em] text-ink">
              {card.title}
            </h3>
            <p className="m-0 mt-[10px] text-[14.5px] leading-[1.6] text-muted">
              {fill(card.body, { days: TRIAL_DAYS })}
            </p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
