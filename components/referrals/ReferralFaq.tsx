import { Reveal } from "@/components/motion/Reveal";
import { FaqList } from "@/components/sections/Faq";
import type { Dict } from "@/lib/i18n/dict";

export function ReferralFaq({ t }: { t: Dict["referralsPage"] }) {
  return (
    <section id="rules" className="shell-narrow pb-[clamp(34px,6vw,72px)] scroll-mt-[90px]">
      <Reveal className="mb-[clamp(24px,4vw,40px)] text-center">
        <h2 className="mx-auto max-w-[20ch] font-display t-h2 font-bold">{t.faqTitle}</h2>
      </Reveal>

      <FaqList items={t.faq} />
    </section>
  );
}
