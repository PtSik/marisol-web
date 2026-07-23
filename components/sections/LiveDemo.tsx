"use client";

import type { Dict, Locale } from "@/lib/i18n/dict";
import dynamic from "vinext/shims/dynamic";

const DemoWidget = dynamic(() => import("@/components/demo/DemoWidget").then((m) => m.DemoWidget), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 items-stretch gap-[18px] md:grid-cols-2">
      <div className="min-h-[380px] animate-pulse rounded-[26px] bg-cream-200" />
      <div className="min-h-[380px] animate-pulse rounded-[26px] bg-cream-200" />
    </div>
  ),
});

export function LiveDemo({
  t,
  widget,
  personas,
  locale,
}: { t: Dict["demo"]; widget: Dict["widget"]; personas: Dict["personas"]; locale: Locale }) {
  return (
    <section id="demo" className="mx-auto max-w-content px-[22px] py-[clamp(48px,7vw,88px)]">
      <div className="mb-[clamp(28px,4vw,40px)] text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          {t.badge}
        </span>
        <h2 className="mx-auto mt-[18px] max-w-[18ch] font-display text-[clamp(28px,5vw,46px)] font-light leading-[1.08] tracking-[-0.03em]">
          {t.title.before}
          <span className="text-teal">{t.title.accent}</span>
          {t.title.after}
        </h2>
        <p className="mx-auto mt-[14px] max-w-[42ch] text-[15.5px] leading-[1.55] text-muted">
          {t.subtitle}
        </p>
        <p className="mx-auto mt-2 max-w-[42ch] text-[13.5px] leading-[1.55] text-muted-2">
          {t.note}
        </p>
      </div>
      <DemoWidget t={widget} personas={personas} locale={locale} />
    </section>
  );
}
