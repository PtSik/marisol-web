"use client";

import { TrialCta } from "@/components/auth/TrialCta";
import type { Dict, Locale } from "@/lib/i18n/dict";
import { telHref } from "@/lib/site";
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

// The showpiece, and the only section on the page that still centres its heading — it earns the
// symmetry because the thing underneath it is symmetrical.
export function LiveDemo({
  t,
  widget,
  personas,
  locale,
  authed,
}: {
  t: Dict["demo"];
  widget: Dict["widget"];
  personas: Dict["personas"];
  locale: Locale;
  authed: boolean;
}) {
  return (
    <section id="demo" className="shell section">
      {/* The measure belongs on the heading, not on this wrapper: `ch` resolves against the
          element's own font-size, and the wrapper inherits 16px, so a cap here stays about 460px
          however large the heading grows — raising the display sizes on a wide screen would only
          have bought extra line wraps. Faq and Pricing already cap on the h2 itself. */}
      <div className="mx-auto mb-[clamp(26px,3.5vw,40px)] text-center">
        <h2 className="mx-auto max-w-[20ch] font-display t-h2 font-bold text-balance">
          {t.title.before}
          <span className="text-teal">{t.title.accent}</span>
          {t.title.after}
        </h2>
        <p className="mx-auto mt-[14px] max-w-[44ch] t-body text-muted">{t.subtitle}</p>
        <p className="mx-auto mt-[10px] max-w-[46ch] t-body-sm text-muted-2">{t.note}</p>
      </div>

      <DemoWidget t={widget} personas={personas} locale={locale} />

      {/* The widget's footer, not a pair of loose buttons under it. The rule spans the widget's own
          width, which is what stops the row reading as debris in the gap between two sections. */}
      <div className="mt-[20px] flex flex-col items-center gap-[16px] border-t border-ink/[0.08] pt-[20px] sm:flex-row sm:justify-between sm:gap-[24px]">
        <a
          href={telHref}
          className="flex min-h-[44px] items-center gap-[9px] t-body-sm text-muted no-underline transition-colors duration-200 hover:text-ink"
        >
          <span
            aria-hidden="true"
            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border border-ink/[0.1] bg-cream-100 text-teal"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </span>
          {t.phoneCta}
        </a>
        <TrialCta
          label={t.trialCta}
          authed={authed}
          locale={locale}
          className="btn btn-md btn-primary"
        />
      </div>
    </section>
  );
}
