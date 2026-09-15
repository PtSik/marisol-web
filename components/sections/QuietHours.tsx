import { Photo } from "@/components/Photo";
import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";

// The one full-bleed moment on the page. It exists to break the column: everything above and below
// is measured to the 1200px shell, and this runs edge to edge, which is what tells the reader a
// chapter ended. No CTA, no cards — a photograph and one sentence.
export function QuietHours({ t }: { t: Dict["quietHours"] }) {
  return (
    <section aria-label={t.ariaLabel} className="relative">
      {/* The 21:9 crop sets the height on desktop; min-height takes over on a phone, where 21:9
          would collapse the band to 170px and crop the room out of the photograph. */}
      <Photo
        name="band-empty-studio"
        alt={t.photoAlt}
        sizes="100vw"
        className="min-h-[360px] sm:min-h-[400px]"
      />

      {/* Two scrims, because the direction has to change with the layout. On desktop the copy sits
          in the left third and a horizontal wash keeps the right of the room visible. On a phone the
          same copy spans the full width and crosses the bright window, where the horizontal version
          measured 3.47:1 — below AA. Below sm it gets an even wash instead. */}
      <div aria-hidden="true" className="absolute inset-0 bg-ink/[0.72] sm:hidden" />
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden bg-gradient-to-r from-ink/[0.86] from-[8%] via-ink/[0.58] to-ink/[0.28] sm:block"
      />

      <div className="absolute inset-0 flex items-center">
        <Reveal className="shell">
          <span className="font-mono t-eyebrow text-cream/60">{t.kicker}</span>
          <h2 className="mt-[14px] font-display t-display font-bold text-cream">
            <span className="block">{t.titleLine1}</span>
            <span className="block">{t.titleLine2}</span>
          </h2>
          <p className="mt-[16px] max-w-[46ch] t-body text-cream/[0.92]">{t.body}</p>
        </Reveal>
      </div>
    </section>
  );
}
