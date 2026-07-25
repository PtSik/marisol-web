import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";

const NUMBERS = ["01", "02", "03"];

export function ReferralSteps({ t }: { t: Dict["referralsPage"] }) {
  return (
    <section className="mx-auto max-w-content px-[22px] py-[clamp(34px,6vw,72px)]">
      <Reveal className="mb-[clamp(24px,4vw,40px)] text-center">
        <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(26px,4.5vw,42px)] font-light leading-[1.08] tracking-[-0.03em]">
          {t.stepsTitle}
        </h2>
      </Reveal>

      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {t.steps.map((step, i) => (
          <Reveal
            as="li"
            key={step.title}
            delay={i * 90}
            className="flex flex-col rounded-[20px] bg-cream-200 px-[24px] py-[26px]"
          >
            <span className="font-display text-[13px] font-medium tracking-[0.04em] text-muted-3">
              {NUMBERS[i]}
            </span>
            <h3 className="mt-[10px] font-display text-[20px] font-normal tracking-[-0.02em] text-ink">
              {step.title}
            </h3>
            <p className="m-0 mt-[10px] text-[14.5px] leading-[1.6] text-muted">{step.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
