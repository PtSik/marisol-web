import { Photo } from "@/components/Photo";
import { Reveal } from "@/components/motion/Reveal";
import type { Dict } from "@/lib/i18n/dict";

// The dark chapter of the page. The panel used to be a flat green rectangle with two blurred blobs
// on it; it is now a photograph of a shop being closed up for the night, pushed well under a green
// scrim so the type stays the brightest thing in the frame.
export function DoneForYou({ t }: { t: Dict["doneForYou"] }) {
  return (
    <section id="how" aria-label={t.ariaLabel} className="shell section-tight">
      <div className="relative overflow-hidden rounded-[26px]">
        <Photo
          name="panel-empty-desk"
          alt={t.photoAlt}
          fill
          // Both scrim panels sit straight inside `.shell`, so the slot is the shell minus its two
          // gutters: 1136px from 1264px up, then growing again once the wide tier unfreezes
          // `--shell` at 1536px, and flat at 1480px from 2108px where the shell meets its ceiling.
          // The middle clause declares the shell itself rather than shell-minus-gutters, which
          // over-states the slot by up to 80px — the safe direction, and never enough to change
          // which rendition is picked.
          sizes="(min-width: 2108px) 1480px, (min-width: 1536px) 74vw, (min-width: 1264px) 1136px, calc(100vw - 64px)"
        />
        {/* Weighted left on desktop, where the type sits, so the lamp still reads on the right.
            Below sm the copy is full-width and the horizontal wash would leave it over the bright
            half, so it gets an even scrim. */}
        <div aria-hidden="true" className="absolute inset-0 bg-[#0C1B18]/[0.88] sm:hidden" />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-gradient-to-r from-[#0C1B18]/[0.95] via-[#102220]/[0.87] to-[#102220]/[0.5] sm:block"
        />

        <div className="relative px-[clamp(22px,4vw,52px)] py-[clamp(34px,4.5vw,58px)]">
          {/* Same rule as the other section headings: the measure goes on the h2, where `ch`
              resolves against the heading's own size. Capped on this wrapper it stayed at the
              wrapper's inherited 16px — about 440px — and the heading wrapped onto two lines the
              moment the display sizes grew. 17ch holds both locales on one line. */}
          <Reveal>
            <h2 className="max-w-[17ch] font-display t-h2 font-bold text-cream text-balance">
              {t.titleTop}
              <span className="text-[#9CD0C4]">{t.titleAccent}</span>
            </h2>
            <p className="mt-[14px] max-w-[50ch] t-body text-cream/[0.8]">{t.subtitle}</p>
          </Reveal>

          <ol className="m-0 mt-[clamp(28px,3.5vw,42px)] grid list-none grid-cols-1 gap-x-[clamp(20px,3vw,40px)] gap-y-[22px] p-0 md:grid-cols-3">
            {t.items.map((item, i) => (
              <Reveal
                as="li"
                key={item.title}
                delay={i * 90}
                className="flex items-start gap-[13px]"
              >
                <span className="mt-[2px] flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[9px] bg-[#9CD0C4]/[0.16]">
                  <span className="t-caption font-semibold text-[#9CD0C4]">{i + 1}</span>
                </span>
                <div>
                  <div className="font-display t-h3 text-cream">{item.title}</div>
                  <div className="mt-[5px] t-body-sm text-cream/[0.72]">{item.desc}</div>
                </div>
              </Reveal>
            ))}
          </ol>
          <p className="relative mt-8 max-w-[75ch] border-t border-cream/20 pt-5 t-body-sm text-cream/80">
            {t.calendarNote}
          </p>
        </div>
      </div>
    </section>
  );
}
