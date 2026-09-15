"use client";

import { Photo } from "@/components/Photo";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/sections/Eyebrow";
import { type Dict, fill } from "@/lib/i18n/dict";
import type { PhotoName } from "@/lib/photos";
import { useEffect, useRef, useState } from "react";

const DWELL_MS = 3200;

// One glyph per business format, in the order the tiles are written: shears, an awning storefront,
// a van, a roller door.
//
// These are Lucide paths (ISC), the same set the rest of the page draws from. The versions here
// before were drawn by hand and looked it — the awning was a crude trapezoid, the van had no
// consistent corner radius, and none of the four carried its neighbour's optical weight. Every
// candidate was then rendered at the size it actually ships at, 22px inside a 48px chip, because
// that is where this gets decided: `caravan` and `truck` both collapse into a blob at 22px, and
// `warehouse` — a roller door — says "out of the garage" far better than a house with a chimney.
const ICONS = [
  <g key="boutique">
    <circle cx="6" cy="6" r="3" />
    <path d="M8.12 8.12 12 12" />
    <path d="M20 4 8.12 15.88" />
    <circle cx="6" cy="18" r="3" />
    <path d="M14.8 14.8 20 20" />
  </g>,
  <g key="storefront">
    <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />
    <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" />
    <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />
  </g>,
  <g key="van">
    <path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3" />
    <path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2" />
    <path d="M9 18h5" />
    <circle cx="16" cy="18" r="2" />
    <circle cx="7" cy="18" r="2" />
  </g>,
  <g key="home">
    <path d="M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11" />
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z" />
    <path d="M6 13h12" />
    <path d="M6 17h12" />
  </g>,
];

function Glyph({ i, size }: { i: number; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[i]}
    </svg>
  );
}

// Photography as category tiles. Each frame is labelled by the *shape of the business*, never by a
// person — which is what keeps it illustrative: a tile says "this is the kind of shop we're for",
// and can't be misread as "this is one of our customers".
//
// The row behaves like MoeGo's hero. One tile holds the focus: it sits inside a teal ring with its
// photograph pushed back, and its content moves to the middle of the frame — glyph, label, and the
// one link on the page that belongs here, because somebody who has just recognised their own shop
// is exactly who should hear the thing answer. The focus walks the row on a timer; a pointer, the
// glyph row, or a Tab key takes it over.
//
// The glyph row is the control, not the tiles. Making a photograph a button gives a screen reader a
// control with no stated effect, and it cannot hold the link the focused tile needs — a button may
// not contain an anchor. So the glyphs carry `aria-pressed`, the tiles carry the pointer handlers,
// and the only focusable thing inside a tile is its link.
export function WhoItsFor({ t }: { t: Dict["whoFor"] }) {
  const count = t.tiles.length;
  // `null` is the pre-enhancement state, and it is also what the server renders: every tile at full
  // strength, nothing dimmed, no ring. The markup that arrives is the finished section, and JS only
  // adds the focus on top of it.
  const [focus, setFocus] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const rowRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const el = rowRef.current;
    if (!el || !("IntersectionObserver" in window)) return;

    // No timer and no repaints while the row is somewhere else on an eleven-thousand-pixel page.
    const io = new IntersectionObserver(
      ([entry]) => {
        setOnScreen(entry.isIntersecting);
        if (entry.isIntersecting) setFocus((f) => f ?? 0);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!onScreen || paused || pinned || focus === null) return;
    const id = window.setInterval(() => setFocus((f) => ((f ?? 0) + 1) % count), DWELL_MS);
    return () => window.clearInterval(id);
  }, [onScreen, paused, pinned, focus, count]);

  const take = (i: number) => {
    setFocus(i);
    setPinned(true);
  };

  return (
    <section aria-label={t.ariaLabel} className="shell section">
      {/* The measure belongs on the heading, not on this wrapper: `ch` resolves against the
          element's own font-size, and the wrapper inherits 16px, so a cap here stays about 460px
          however large the heading grows — raising the display sizes on a wide screen would only
          have bought extra line wraps. Faq and Pricing already cap on the h2 itself. */}
      <Reveal className="mx-auto mb-[clamp(20px,2.6vw,30px)] text-center">
        <Eyebrow variant="plain" align="center">
          {t.badge}
        </Eyebrow>
        <h2 className="mx-auto mt-[14px] max-w-[17ch] font-display t-h2 font-bold text-balance">
          {t.title.before}
          <span className="text-teal">{t.title.accent}</span>
          {t.title.after}
        </h2>
        <p className="mx-auto mt-[14px] max-w-[52ch] t-body text-muted">{t.subtitle}</p>
      </Reveal>

      {/* A fieldset, like the billing and persona toggles: a named group of buttons where exactly
          one is pressed. The glyphs are the control for the row — the tiles only follow. */}
      <fieldset className="m-0 mb-[clamp(20px,2.6vw,30px)] hidden flex-wrap lg:flex items-center justify-center gap-[10px] border-0 p-0">
        <legend className="sr-only">{t.pickerLabel}</legend>
        {t.tiles.map((tile, i) => (
          <button
            key={tile.label}
            type="button"
            aria-label={tile.label}
            aria-pressed={focus === i}
            onClick={() => take(i)}
            onPointerEnter={() => setFocus(i)}
            onFocus={() => setFocus(i)}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-200 ${
              focus === i
                ? "border-ink bg-ink text-cream shadow-[0_8px_18px_-8px_rgba(36,27,20,0.6)]"
                : "border-ink/[0.08] bg-offwhite text-teal shadow-[0_2px_6px_-3px_rgba(36,27,20,0.3)] hover:border-teal/45 hover:text-teal"
            }`}
          >
            <Glyph i={i} size={22} />
          </button>
        ))}
      </fieldset>

      <ul
        ref={rowRef}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        data-focus-row={focus === null ? undefined : ""}
        className="m-0 grid list-none grid-cols-2 gap-[clamp(10px,1.4vw,18px)] p-0 lg:grid-cols-4"
      >
        {t.tiles.map((tile, i) => {
          const active = focus === i;
          return (
            <Reveal
              as="li"
              key={tile.label}
              delay={i * 80}
              className={`mg-tile relative overflow-visible rounded-[18px] lg:overflow-hidden ${active ? "is-focused" : ""}`}
            >
              <Photo
                name={tile.photo as PhotoName}
                alt={tile.alt}
                sizes="(min-width: 1024px) 23vw, 46vw"
                className="mg-tile-frame rounded-[18px]"
                imgClassName="mg-tile-photo"
                style={{ aspectRatio: "var(--tile-ar)" }}
              />
              {/* The scrim is part of the tile, not a hover state — the label has to stay legible in
                  the first still frame, before anyone has moved a pointer. */}
              <div
                aria-hidden="true"
                className="mg-scrim pointer-events-none absolute inset-0 rounded-[18px] bg-gradient-to-t from-ink/[0.9] from-[10%] via-ink/[0.52] via-[40%] to-transparent"
              />

              {/* A pointer target for the whole tile, under the focused face so the link there stays
                  clickable. Hidden from assistive technology and not a tab stop: the glyph row is
                  the control, this is only the convenience of clicking the picture you are
                  already looking at. */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onPointerEnter={() => setFocus(i)}
                onClick={() => take(i)}
                className="absolute inset-0 z-[1] cursor-pointer"
              />

              {/* The resting face, and the only copy in the accessibility tree. */}
              <div className="mg-rest relative px-[2px] pt-[9px] lg:absolute lg:inset-x-0 lg:bottom-0 lg:p-[clamp(12px,1.6vw,18px)] lg:text-center">
                <div className="text-ink lg:text-offwhite">
                  <span className="font-display t-h3">{tile.label}</span>
                </div>
                {/* Two lines of room whether the line needs them or not, so the labels keep a common
                    baseline across the row instead of stepping up and down with the copy. */}
                <div className="mt-[5px] hidden min-h-[36px] t-caption text-offwhite/85 lg:block">
                  {tile.desc}
                </div>
              </div>

              {/* The focused face. Duplicated copy, so it is hidden from assistive technology — the
                  link below it is the one thing here that is not. */}
              <div className="mg-active absolute inset-0 z-[2] flex-col items-center justify-center gap-[10px] p-[16px] text-center">
                <div aria-hidden="true" className="relative flex flex-col items-center gap-[10px]">
                  <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-offwhite/[0.16] text-offwhite backdrop-blur-sm">
                    <Glyph i={i} size={21} />
                  </span>
                  <span className="font-display t-stat leading-[1.15] tracking-[-0.02em] text-offwhite">
                    {tile.label}
                  </span>
                  <span className="max-w-[22ch] t-caption text-offwhite/85">{tile.desc}</span>
                </div>
                <a
                  href="#demo"
                  tabIndex={active ? 0 : -1}
                  aria-label={fill(t.ctaAria, { label: tile.label })}
                  className="relative mt-[2px] inline-flex min-h-[40px] items-center justify-center gap-[7px] rounded-full border border-offwhite/60 px-[16px] t-caption font-medium text-offwhite no-underline transition-colors duration-200 hover:border-offwhite hover:bg-offwhite hover:text-ink"
                >
                  {t.cta}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
              </div>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
