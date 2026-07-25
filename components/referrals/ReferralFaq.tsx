import { Reveal } from "@/components/motion/Reveal";
import { FaqList } from "@/components/sections/Faq";
import type { Dict } from "@/lib/i18n/dict";

export function ReferralFaq({ t }: { t: Dict["referralsPage"] }) {
  return (
    <section
      id="rules"
      className="mx-auto max-w-[760px] px-[22px] pb-[clamp(34px,6vw,72px)] scroll-mt-[90px]"
    >
      <Reveal className="mb-[clamp(24px,4vw,40px)] text-center">
        <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(26px,4.5vw,42px)] font-light leading-[1.08] tracking-[-0.03em]">
          {t.faqTitle}
        </h2>
      </Reveal>

      <FaqList items={t.faq} />
    </section>
  );
}
