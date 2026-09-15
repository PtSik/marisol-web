import { Reveal } from "@/components/motion/Reveal";
import { type Dict, fill } from "@/lib/i18n/dict";
import { TRIAL_DAYS } from "@/lib/plans";

export function ReferralWhy({ t }: { t: Dict["referralsPage"] }) {
  return (
    <section className="shell pb-[clamp(34px,6vw,72px)]">
      <Reveal className="mb-[clamp(24px,4vw,40px)] text-center">
        <h2 className="mx-auto max-w-[20ch] font-display t-h2 font-bold">{t.whyTitle}</h2>
      </Reveal>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {t.why.map((card, i) => (
          <Reveal
            as="li"
            key={card.title}
            delay={i * 90}
            className="flex flex-col rounded-[20px] border border-ink/[0.07] px-[24px] py-[26px]"
          >
            <h3 className="font-display t-h3 font-normal text-ink">{card.title}</h3>
            <p className="m-0 mt-[10px] t-body-sm text-muted">
              {fill(card.body, { days: TRIAL_DAYS })}
            </p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
