import { Reveal } from "@/components/motion/Reveal";

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
      </Reveal>
    </section>
  );
}
