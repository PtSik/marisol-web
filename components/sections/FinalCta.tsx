"use client";

import { CallRequestForm } from "@/components/CallRequestForm";
import { Photo } from "@/components/Photo";
import { TrialCta } from "@/components/auth/TrialCta";
import { Reveal } from "@/components/motion/Reveal";
import { type Dict, type Locale, fill } from "@/lib/i18n/dict";
import { TRIAL_DAYS } from "@/lib/plans";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { useState } from "react";

export function FinalCta({
  t,
  form,
  locale,
  authed,
}: { t: Dict["finalCta"]; form: Dict["callForm"]; locale: Locale; authed: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <section aria-label={t.ariaLabel} className="shell section-tight">
      <div className="relative overflow-hidden rounded-[30px] px-6 py-[clamp(44px,8vw,88px)] text-center [transform:translateZ(0)] [clip-path:inset(0_round_30px)]">
        {/* A photograph under the closing panel, not a flat field: an open door, a water bowl on
            the step, a grooming table just visible inside, and nobody in the frame. The moody
            phone-on-an-empty-counter shots in the shoot all say the opposite of what this panel is
            asking for — they are the problem, not the promise.

            The palette then goes *over* the photograph rather than instead of it: a deep green wash
            carries almost all of the text contrast, and the two blooms, at a third of the alpha
            they needed on their own, tint the daylight coming through the door back toward the
            brand. Without the wash this is a stock photo with words on it. */}
        <Photo
          name="cta-storefront-open"
          alt=""
          fill
          // Both scrim panels sit straight inside `.shell`, so the slot is the shell minus its two
          // gutters: 1136px from 1264px up, then growing again once the wide tier unfreezes
          // `--shell` at 1536px, and flat at 1480px from 2108px where the shell meets its ceiling.
          // The middle clause declares the shell itself rather than shell-minus-gutters, which
          // over-states the slot by up to 80px — the safe direction, and never enough to change
          // which rendition is picked.
          sizes="(min-width: 2108px) 1480px, (min-width: 1536px) 74vw, (min-width: 1264px) 1136px, calc(100vw - 64px)"
          imgClassName="object-[58%_50%]"
        />
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, background: "#17302B", opacity: 0.46 }}
        />
        {/* The scrim is centred rather than flat. A flat wash heavy enough to carry the subtitle
            took the daylight out of the whole frame and left a murky green rectangle; this puts the
            weight where the words are and lets the corners keep the photograph. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 66% 82% at 50% 50%,rgba(9,24,21,0.7) 0%,rgba(9,24,21,0.44) 58%,rgba(9,24,21,0.08) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "-20%",
            filter: "blur(60px)",
            background:
              "radial-gradient(44% 58% at 14% 6%,rgba(242,176,116,0.3) 0%,rgba(242,176,116,0) 64%),radial-gradient(58% 66% at 74% 78%,rgba(94,158,144,0.46) 0%,rgba(94,158,144,0) 70%)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg,rgba(15,30,28,.34) 0%,rgba(15,30,28,.08) 38%,rgba(15,30,28,.42) 100%)",
          }}
        />
        <Reveal className="relative z-[2]">
          <h2 className="mx-auto max-w-[16ch] font-display t-display font-bold text-cream [text-shadow:0_1px_30px_rgba(10,24,22,0.35)]">
            {t.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[34ch] t-lead text-cream/[0.86]">
            {fill(t.subtitle, { days: TRIAL_DAYS })}
          </p>
          <div className="mt-7">
            <TrialCta
              label={t.trialCta}
              authed={authed}
              locale={locale}
              className="btn btn-lg btn-on-dark"
            />
          </div>
          {open ? (
            <div className="mx-auto mt-7 max-w-[640px]">
              <CallRequestForm t={form} onCancel={() => setOpen(false)} />
            </div>
          ) : (
            <div className="mx-auto mt-7 flex w-fit flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="min-h-[44px] text-sm text-cream underline underline-offset-4"
              >
                {t.button}
              </button>
              <a href={SALES_EMAIL_HREF} className="t-body-sm text-cream/70 underline">
                {t.email}
              </a>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
