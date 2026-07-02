"use client";

import { CallRequestForm } from "@/components/CallRequestForm";
import { Reveal } from "@/components/motion/Reveal";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { useState } from "react";

export function FinalCta() {
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-label="Get started"
      className="mx-auto max-w-content px-[22px] pt-[clamp(32px,6vw,72px)] pb-[clamp(40px,7vw,80px)]"
    >
      <div className="relative overflow-hidden rounded-[30px] px-6 py-[clamp(44px,8vw,88px)] text-center [transform:translateZ(0)] [clip-path:inset(0_round_30px)]">
        <div style={{ position: "absolute", inset: 0, background: "#1B2E2B" }} />
        <div
          style={{
            position: "absolute",
            inset: "-20%",
            filter: "blur(60px)",
            background:
              "radial-gradient(34% 46% at 30% 24%,#F2A65A 0%,rgba(242,166,90,0) 62%),radial-gradient(40% 52% at 72% 30%,#E8552C 0%,rgba(232,85,44,0) 60%),radial-gradient(46% 58% at 84% 74%,#D8431F 0%,rgba(216,67,31,0) 58%),radial-gradient(50% 60% at 16% 82%,#1F6E63 0%,rgba(31,110,99,0) 60%),radial-gradient(60% 70% at 50% 108%,#143F39 0%,rgba(20,63,57,0) 62%),radial-gradient(38% 44% at 58% 56%,#F6C26B 0%,rgba(246,194,107,0) 56%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg,rgba(15,30,28,.28) 0%,rgba(15,30,28,0) 32%,rgba(15,30,28,.34) 100%)",
          }}
        />
        <Reveal className="relative z-[2]">
          <h2 className="mx-auto max-w-[16ch] font-display text-[clamp(30px,5.5vw,54px)] font-light leading-[1.05] tracking-[-0.03em] text-cream [text-shadow:0_1px_30px_rgba(10,24,22,0.35)]">
            Let every call get answered.
          </h2>
          <p className="mx-auto mt-4 max-w-[34ch] text-[clamp(15px,2.2vw,18px)] leading-[1.5] text-cream/[0.86]">
            Have questions about pricing or setup? Book a quick call or send us a question — we'll
            get back to you fast.
          </p>
          {open ? (
            <div className="mx-auto mt-7 max-w-[640px]">
              <CallRequestForm onCancel={() => setOpen(false)} />
            </div>
          ) : (
            <div className="mx-auto mt-7 flex w-fit flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex min-h-[52px] items-center justify-center gap-[9px] rounded-xl bg-cream px-7 py-[15px] text-base font-medium text-ink"
              >
                Book a 15-min call
              </button>
              <a href={SALES_EMAIL_HREF} className="text-[13.5px] text-cream/70 underline">
                or email our sales team
              </a>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
