import { Photo } from "@/components/Photo";
import type { Dict, Locale } from "@/lib/i18n/dict";

// A short, labeled example complements the live demo below.
function CallCard({ t }: { t: Dict["hero"]["call"] }) {
  return (
    <div className="w-full rounded-[18px] border border-ink/[0.07] bg-offwhite/95 p-[15px] shadow-[0_26px_56px_-26px_rgba(36,27,20,0.45)] backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-ink/[0.07] pb-[11px]">
        <span className="t-caption font-medium tracking-[0.01em] text-muted-2">{t.status}</span>
      </div>

      <ol className="m-0 flex list-none flex-col gap-[9px] p-0 pt-[12px] sm:gap-[7px]">
        {t.lines.map((line) => {
          const mine = line.who === "marisol";
          return (
            <li
              key={line.text}
              className={`flex flex-col gap-[3px] ${mine ? "items-end" : "items-start"}`}
            >
              {/* Hidden on a phone, where the card is narrow enough that four name rows were half
                  the height of the transcript. Side and colour already say who is talking; the text
                  stays in the accessibility tree for anyone the colour doesn't reach. */}
              <span className="sr-only px-1 t-eyebrow text-muted-2 sm:not-sr-only">
                {mine ? t.speakerMarisol : t.speakerCaller}
              </span>
              <span
                className={`max-w-[94%] rounded-[12px] px-[11px] py-[7px] t-caption leading-[1.4] ${
                  mine
                    ? "rounded-br-[5px] bg-teal text-offwhite"
                    : "rounded-bl-[5px] bg-cream-200 text-ink"
                }`}
              >
                {line.text}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Hero({ t, locale }: { t: Dict["hero"]; locale: Locale }) {
  const pricingHref = locale === "es" ? "/es/pricing" : "/pricing";

  return (
    <header className="relative lg:flex lg:grow lg:flex-col">
      {/* Replaces the 3.3 MB bokeh PNG: the same warmth, drawn by the GPU, nothing to download.
          The box reaches above the header because the sticky nav sits there: clipped at the
          header's own top edge, the tint stopped dead in a straight line along the bottom of the
          bar. It still clips left and right, which is what keeps the -10% bleed off the scrollbar. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[-160px] overflow-hidden"
      >
        <div className="hero-field" />
      </div>

      <div className="shell relative grid items-center gap-[clamp(38px,4.2vw,52px)] pb-[clamp(40px,5vw,66px)] pt-[clamp(26px,3.4vw,46px)] lg:grow lg:grid-cols-[1fr_1.15fr]">
        <div className="max-w-[620px] text-center sm:text-left 2xl:max-w-[720px]">
          {/* The weight break is the headline, not the colour. The accent phrase was already
              separated out in the copy; it just used to spend that separation on teal alone at a
              single light weight. 400 -> 800 is what makes the promise land, and the full stop
              goes with the accent so the sentence closes on the emphasis rather than after it. */}
          <h1 className="font-display t-h1 font-normal text-balance">
            {t.title.before}
            <span className="font-extrabold text-teal">
              {t.title.accent}
              {t.title.after}
            </span>
          </h1>

          {/* Not muted. A subtitle set in the muted brown at 400 reads as a caption under the
              headline; at ink and 500 it reads as the second half of the promise. */}
          <p className="mx-auto mt-[14px] max-w-[50ch] t-lead font-medium text-ink sm:mx-0 sm:mt-[20px]">
            {t.subtitle}
          </p>

          <div className="mx-auto mt-[22px] flex max-w-[264px] flex-col items-stretch gap-[10px] sm:mx-0 sm:mt-[28px] sm:max-w-none sm:flex-row sm:items-center">
            <a href="#demo" className="btn btn-lg btn-primary">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
              </svg>
              {t.ctaDemo}
            </a>
            <a href={pricingHref} className="btn btn-lg btn-secondary">
              {t.ctaPricing}
            </a>
          </div>

          <p className="mt-[12px] t-caption text-muted-2 sm:mt-[15px]">{t.demoNote}</p>
        </div>

        {/* The photo and the card are one object. The card hangs off the lower-right corner: the
            reception desk and the lit phone are in the left third of the frame, so anything
            covering that side throws away the reason this photograph is here.

            From lg this column is as tall as the first screen leaves it, which is what puts the
            trust strip's lower border on the fold. The cap keeps a tall window from stretching the
            frame into a portrait: past it the slack becomes air around the photo instead. It rises
            with the window rather than sitting at a flat 640px, because on a 1440px-tall screen a
            flat cap left 520px of that slack as cream above and below the photograph.

            On a phone it is the same arrangement at phone scale: the card hangs off the lower-right
            corner, narrower than the photo and sunk into it, with 10px of the 20px gutter to spare.
            Matched to the photo's width and centred, the two read as the halves of one tall panel —
            same edges, same corner radius, straight seam — not as a card resting on a picture. */}
        <div className="relative mx-auto w-full max-w-[520px] lg:h-full lg:max-h-[clamp(640px,62vh,900px)] lg:max-w-none">
          <div className="relative [aspect-ratio:4/3] overflow-hidden rounded-[22px] shadow-[0_30px_60px_-34px_rgba(36,27,20,0.55)] sm:rounded-[26px] sm:shadow-[0_44px_90px_-46px_rgba(36,27,20,0.6)] sm:[aspect-ratio:5/4] lg:h-full lg:[aspect-ratio:auto]">
            <Photo
              name="hero-frontdesk"
              alt={t.photoAlt}
              priority
              fill
              // The source is square and its lower third is unlit floor under the desk. Cropping
              // from above centre keeps the windows, the desk and the lit phone and throws away only
              // that shadow, at whatever ratio the slot ends up: from lg the slot has no ratio of its
              // own, it is as tall as the first screen leaves it, so this holds the framing steady
              // across window heights instead of one chosen crop being right at one of them.
              // On a phone the band sits lower, which lifts the desk and the lit phone clear of the
              // card overlapping the bottom of the frame.
              imgClassName="object-[50%_46%] sm:object-[50%_32%]"
              sizes="(min-width: 1024px) 54vw, (min-width: 640px) 520px, 92vw"
            />
          </div>
          <div className="relative z-[2] -mr-[10px] ml-auto -mt-[108px] w-[min(74%,252px)] sm:mx-auto sm:-mt-[54px] sm:w-[min(100%,330px)] lg:absolute lg:bottom-[18px] lg:right-[-26px] lg:mt-0 lg:w-[292px] xl:right-[-44px] xl:w-[310px]">
            <CallCard t={t.call} />
          </div>
        </div>
      </div>
    </header>
  );
}
