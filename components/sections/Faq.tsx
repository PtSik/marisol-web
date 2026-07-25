import { Reveal } from "@/components/motion/Reveal";
import { type Dict, fill } from "@/lib/i18n/dict";
import { TRIAL_DAYS } from "@/lib/plans";

export interface FaqItem {
  q: string;
  a: string;
  termsLink?: string | null;
  linkHref?: string;
}

export function FaqList({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <Reveal key={item.q} delay={i * 60}>
          <details className="group overflow-hidden rounded-[18px] bg-cream-200">
            <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 px-[22px] py-5 text-[clamp(15px,2.2vw,17px)] font-medium text-ink [&::-webkit-details-marker]:hidden">
              {item.q}
              <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full transition-transform duration-300 group-open:rotate-180">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="text-ink"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </summary>
            <p className="m-0 px-[22px] pb-[22px] text-[14.5px] leading-[1.6] text-muted">
              {fill(item.a, { days: TRIAL_DAYS })}
              {item.termsLink && (
                <>
                  <a href={item.linkHref ?? "/terms"} className="font-medium text-teal">
                    {item.termsLink}
                  </a>
                  .
                </>
              )}
            </p>
          </details>
        </Reveal>
      ))}
    </div>
  );
}

export function Faq({ t }: { t: Dict["faq"] }) {
  return (
    <section id="faq" className="mx-auto max-w-[760px] px-[22px] py-[clamp(30px,4vw,46px)]">
      <Reveal className="mb-[clamp(30px,5vw,44px)] text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[15px] py-[8px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          {t.badge}
        </span>
        <h2 className="mx-auto mt-[clamp(22px,4vw,36px)] max-w-[16ch] font-display text-[clamp(28px,5vw,46px)] font-light leading-[1.08] tracking-[-0.03em]">
          {t.title.before}
          <span className="text-teal">{t.title.accent}</span>
          {t.title.after}
        </h2>
      </Reveal>

      <FaqList items={t.items} />
    </section>
  );
}
