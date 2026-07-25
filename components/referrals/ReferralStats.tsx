import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";

export function ReferralStats({ t }: { t: Dict["referralsPage"] }) {
  return (
    <section className="mx-auto max-w-content px-[22px] py-[clamp(16px,3vw,32px)]">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {t.stats.map((stat, i) => (
          <Reveal
            as="li"
            key={stat.value}
            delay={i * 70}
            className="flex flex-col justify-center rounded-[18px] border border-ink/[0.07] bg-cream-200 px-[18px] py-[22px] text-center"
          >
            <div className="font-display text-[clamp(26px,3.8vw,36px)] font-light leading-none tracking-[-0.03em] text-ink">
              {stat.value}
            </div>
            <div className="mt-[10px] text-[13px] leading-[1.45] text-muted-2">{stat.label}</div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
