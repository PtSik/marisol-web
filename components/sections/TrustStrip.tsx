import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";

// Real client names. Nothing else goes in this block — no photograph, no avatar, no face — because
// anything with a person in it, sitting beside these names, reads as a claim that the person is one
// of them. The photography on this page stays out of here on purpose.
const BRANDS = [
  { name: "Sharp & Co.", className: "" },
  { name: "LUMA SPA", className: "font-sans font-semibold tracking-[0.02em]" },
  { name: "the dog house", className: "italic" },
  { name: "Velvet Nails", className: "font-medium" },
  { name: "BARBAROSSA", className: "font-sans tracking-[0.18em] text-[0.8em]" },
];

// The loop travels -50% of the track, so one half has to be at least as wide as the strip or the
// tail of the second copy scrolls into view and leaves a gap. Two copies measure 866px of travel
// against an 892px strip at 2560px wide — 26px short, which the edge fade still covers — but the
// wide tier takes the strip past 1200px, where the shortfall is far too big to hide. Four copies
// (an even count, so -50% still lands on an identical frame) clear any strip up to ~1730px.
const MARQUEE = [...BRANDS, ...BRANDS, ...BRANDS, ...BRANDS];

export function TrustStrip({ t }: { t: Dict["trust"] }) {
  return (
    <section aria-label={t.ariaLabel} className="border-y border-ink/[0.07] bg-cream-100">
      <Reveal className="shell flex flex-col items-center gap-[16px] py-[26px] sm:flex-row sm:gap-[clamp(24px,4vw,56px)]">
        <span className="flex-none t-eyebrow text-muted-2">{t.kicker}</span>
        <div
          className="flex w-full min-w-0 overflow-hidden"
          style={{
            WebkitMaskImage: "linear-gradient(to right,transparent,#000 8%,#000 92%,transparent)",
            maskImage: "linear-gradient(to right,transparent,#000 8%,#000 92%,transparent)",
          }}
        >
          <div
            aria-hidden="true"
            className="marquee-track flex w-max flex-none items-center gap-[clamp(26px,5vw,56px)] whitespace-nowrap pr-[clamp(26px,5vw,56px)] font-display text-[clamp(15px,2vw,20px)] tracking-[-0.01em] text-ink opacity-50"
          >
            {MARQUEE.map((b, i) => (
              <span key={`${b.name}-${i}`} className={b.className}>
                {b.name}
              </span>
            ))}
          </div>
        </div>
        {/* The marquee is decorative duplication; the list itself stays in the accessibility tree. */}
        <ul className="sr-only">
          {BRANDS.map((b) => (
            <li key={b.name}>{b.name}</li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
