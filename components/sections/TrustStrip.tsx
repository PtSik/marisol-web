import { Reveal } from "@/components/motion/Reveal";

// const BENEFITS = [
//   { stat: "24/7", desc: "every call answered" },
//   { stat: "Instant", desc: "no hold, no voicemail" },
//   { stat: "Booked", desc: "straight into your calendar" },
// ];

const BRANDS = [
  { name: "Sharp & Co.", className: "" },
  { name: "LUMA SPA", className: "font-sans font-semibold tracking-[0.02em]" },
  { name: "the dog house", className: "italic" },
  { name: "Velvet Nails", className: "font-medium" },
  { name: "BARBAROSSA", className: "font-sans tracking-[0.18em] text-[0.8em]" },
];

export function TrustStrip() {
  return (
    <section aria-label="Trusted by" className="border-y border-cream-200 bg-cream-100">
      <Reveal className="mx-auto flex max-w-content flex-col items-center gap-[18px] px-[22px] py-[26px]">
        <span className="text-xs uppercase tracking-[0.14em] text-muted-4">The front desk for</span>
        <div
          className="flex w-full overflow-hidden"
          style={{
            WebkitMaskImage: "linear-gradient(to right,transparent,#000 12%,#000 88%,transparent)",
            maskImage: "linear-gradient(to right,transparent,#000 12%,#000 88%,transparent)",
          }}
        >
          <div
            aria-hidden="true"
            className="marquee-track flex w-max flex-none items-center gap-[clamp(20px,5vw,52px)] whitespace-nowrap pr-[clamp(20px,5vw,52px)] font-display text-[clamp(15px,2.4vw,21px)] tracking-[-0.01em] text-ink opacity-55"
          >
            {[...BRANDS, ...BRANDS].map((b, i) => (
              <span key={`${b.name}-${i}`} className={b.className}>
                {b.name}
              </span>
            ))}
          </div>
        </div>

        {/* <dl className="m-0 flex w-full flex-col items-center justify-center gap-3 border-t border-cream-200 pt-[18px] sm:flex-row sm:gap-[clamp(28px,6vw,72px)]">
          {BENEFITS.map((b) => (
            <div key={b.stat} className="flex items-baseline gap-2">
              <dt className="sr-only">{b.desc}</dt>
              <dd className="m-0 flex items-baseline gap-2">
                <span className="font-display text-[clamp(17px,2.4vw,22px)] tracking-[-0.02em] text-ink">
                  {b.stat}
                </span>
                <span className="text-[13px] text-muted">{b.desc}</span>
              </dd>
            </div>
          ))}
        </dl> */}
      </Reveal>
    </section>
  );
}
