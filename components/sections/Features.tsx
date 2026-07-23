import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";

const ICONS = [
  {
    svg: (
      <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
    ),
  },
  {
    svg: (
      <>
        <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
        <path d="M16 2v4" />
        <path d="M8 2v4" />
        <path d="M3 10h5" />
        <path d="M17.5 17.5 16 16.25V14" />
        <circle cx="16" cy="16" r="6" />
      </>
    ),
  },
  {
    svg: (
      <>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    svg: (
      <>
        <path d="m3 17 2 2 4-4" />
        <path d="m3 7 2 2 4-4" />
        <path d="M13 6h8" />
        <path d="M13 12h8" />
        <path d="M13 18h8" />
      </>
    ),
  },
];

export function Features({ t }: { t: Dict["features"] }) {
  return (
    <section
      aria-label={t.ariaLabel}
      className="mx-auto max-w-content px-[22px] py-[clamp(48px,7vw,88px)]"
    >
      <Reveal className="mb-[clamp(34px,5vw,52px)] text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          {t.badge}
        </span>
        <h2 className="mx-auto mt-[18px] max-w-[16ch] font-display text-[clamp(28px,5vw,46px)] font-light leading-[1.08] tracking-[-0.03em]">
          {t.title.before}
          <span className="text-teal">{t.title.accent}</span>
          {t.title.after}
        </h2>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {t.items.map((f, i) => (
          <Reveal
            key={f.title}
            delay={i * 90}
            className="rounded-[22px] bg-cream-200 p-5 sm:p-[26px]"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cream">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-ink"
              >
                {ICONS[i].svg}
              </svg>
            </div>
            <h3 className="mb-[6px] font-display text-[clamp(16px,4.4vw,22px)] tracking-[-0.02em]">
              {f.title}
            </h3>
            <p className="text-[13.5px] leading-[1.5] text-muted sm:text-[14.5px] sm:leading-[1.55]">
              {f.desc}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
