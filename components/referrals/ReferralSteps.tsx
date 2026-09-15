import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";

const NUMBERS = ["01", "02", "03"];

export function ReferralSteps({ t }: { t: Dict["referralsPage"] }) {
  return (
    <section className="shell py-[clamp(34px,6vw,72px)]">
      <Reveal className="mb-[clamp(24px,4vw,40px)] text-center">
        <h2 className="mx-auto max-w-[20ch] font-display t-h2 font-bold">{t.stepsTitle}</h2>
      </Reveal>

      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {t.steps.map((step, i) => (
          <Reveal
            as="li"
            key={step.title}
            delay={i * 90}
            className="surface flex flex-col rounded-[20px] px-[24px] py-[26px]"
          >
            <span className="font-display t-caption font-medium tracking-[0.04em] text-muted-3">
              {NUMBERS[i]}
            </span>
            <h3 className="mt-[10px] font-display t-h3 font-normal text-ink">{step.title}</h3>
            <p className="m-0 mt-[10px] t-body-sm text-muted">{step.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
