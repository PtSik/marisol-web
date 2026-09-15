import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";

export function ReferralStats({ t }: { t: Dict["referralsPage"] }) {
  return (
    <section className="shell py-[clamp(16px,3vw,32px)]">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {t.stats.map((stat, i) => (
          <Reveal
            as="li"
            key={stat.value}
            delay={i * 70}
            className="surface flex flex-col justify-center rounded-[18px] px-[18px] py-[22px] text-center"
          >
            <div className="font-display text-[clamp(26px,3.8vw,36px)] font-bold leading-none tracking-[-0.018em] text-ink">
              {stat.value}
            </div>
            <div className="mt-[10px] t-caption text-muted-2">{stat.label}</div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
