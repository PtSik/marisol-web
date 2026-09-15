import { Photo } from "@/components/Photo";
import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";

const ICONS = [
  <path
    key="0"
    d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"
  />,
  <g key="1">
    <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h5" />
    <path d="M17.5 17.5 16 16.25V14" />
    <circle cx="16" cy="16" r="6" />
  </g>,
  <g key="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    <path d="m9 12 2 2 4-4" />
  </g>,
];

function Icon({ i, lead = false }: { i: number; lead?: boolean }) {
  return (
    <span className={`icon-tile mb-[16px] ${lead ? "h-[52px] w-[52px]" : "h-[44px] w-[44px]"}`}>
      <svg
        width={lead ? 25 : 21}
        height={lead ? 25 : 21}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-teal"
      >
        {ICONS[i]}
      </svg>
    </span>
  );
}

export function Features({ t }: { t: Dict["features"] }) {
  const [lead, ...rest] = t.items;

  return (
    <section aria-label={t.ariaLabel} className="shell section">
      {/* The measure belongs on the heading, not on this wrapper: `ch` resolves against the
          element's own font-size, and the wrapper inherits 16px, so a cap here stays about 460px
          however large the heading grows — raising the display sizes on a wide screen would only
          have bought extra line wraps. Faq and Pricing already cap on the h2 itself. */}
      <Reveal className="mx-auto mb-[clamp(28px,3.5vw,44px)] text-center">
        <h2 className="mx-auto max-w-[17ch] font-display t-h2 font-bold text-balance">
          {t.title.before}
          <span className="text-teal">{t.title.accent}</span>
          {t.title.after}
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 gap-[clamp(10px,1.3vw,16px)] sm:grid-cols-2 lg:grid-cols-12">
        <Reveal className="surface surface-lift flex flex-col justify-center rounded-[20px] p-[clamp(20px,2.4vw,30px)] sm:col-span-2 lg:col-span-6 lg:min-h-[236px]">
          <Icon i={0} lead />
          <h3 className="font-display t-h3 font-normal leading-[1.18] tracking-[-0.025em]">
            {lead.title}
          </h3>
          <p className="mt-[10px] max-w-[46ch] t-body text-muted">{lead.desc}</p>
        </Reveal>

        <Reveal
          delay={70}
          className="relative min-h-[268px] overflow-hidden rounded-[20px] sm:col-span-2 sm:min-h-[240px] lg:col-span-6 lg:min-h-0"
        >
          <Photo
            name="feature-hands-phone"
            alt={t.photoAlt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-ink/[0.9] via-ink/[0.44] to-ink/[0.05]"
          />
          <p className="absolute inset-x-0 bottom-0 m-0 max-w-[30ch] p-[clamp(16px,2vw,22px)] font-display t-lead font-semibold leading-[1.3] tracking-[-0.015em] text-offwhite">
            {t.photoCaption}
          </p>
        </Reveal>

        {rest.map((f, i) => (
          <Reveal
            key={f.title}
            delay={(i + 2) * 70}
            className="surface surface-lift rounded-[20px] p-[clamp(18px,2vw,24px)] lg:col-span-6"
          >
            <Icon i={i + 1} />
            <h3 className="font-display t-h3 font-semibold">{f.title}</h3>
            <p className="mt-[8px] t-body-sm text-muted">{f.desc}</p>
          </Reveal>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-[60ch] text-center t-body-sm text-muted">{t.handoff}</p>
    </section>
  );
}
