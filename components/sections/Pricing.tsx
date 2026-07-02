"use client";

import { Reveal } from "@/components/motion/Reveal";
import { MULTI_LOCATION_FEATURES, PLAN_FEATURES, PRICE } from "@/lib/plans";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { useEffect, useRef, useState } from "react";

const PLAN_TABS = ["Individual", "Custom"];

function FeatureList({
  feats,
  check,
  itemCls,
}: { feats: string[]; check: string; itemCls: string }) {
  return (
    <ul className="mb-[22px] flex flex-1 flex-col gap-[11px]">
      {feats.map((feat) => (
        <li
          key={feat}
          className={`flex items-start gap-[10px] text-[14px] leading-[1.45] ${itemCls}`}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke={check}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-[1px] flex-none"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {feat}
        </li>
      ))}
    </ul>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [activePrice, setActivePrice] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const billing = annual ? "annual" : "monthly";

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const sync = () => {
      const cards = grid.querySelectorAll<HTMLElement>(".price-card");
      for (const card of cards) card.style.height = "";
      if (window.innerWidth >= 768) {
        grid.style.height = "";
        return;
      }
      const tallest = Math.max(...Array.from(cards, (card) => card.offsetHeight));
      if (tallest > 0) {
        grid.style.height = `${tallest}px`;
        for (const card of cards) card.style.height = `${tallest}px`;
      }
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const cardInteraction = (i: number) => ({
    onClick: () => setActivePrice(i),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActivePrice(i);
      }
    },
  });

  return (
    <section
      id="pricing"
      className="mx-auto max-w-content px-[22px] pb-[clamp(20px,3vw,40px)] pt-[clamp(48px,7vw,88px)]"
    >
      <Reveal className="mb-[clamp(28px,4vw,40px)] text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          Pricing
        </span>
        <h2 className="mx-auto mt-[18px] max-w-[18ch] font-display text-[clamp(28px,5vw,46px)] font-light leading-[1.08] tracking-[-0.03em]">
          One flat fee. <span className="text-teal">Every call</span> answered.
        </h2>
        <p className="mx-auto mt-[14px] max-w-[42ch] text-[15.5px] leading-[1.55] text-muted">
          No tiers, no per-minute charges, no setup fees. Cancel anytime — keep your number.
        </p>

        <fieldset className="m-0 mt-6 inline-flex items-center gap-1 rounded-[14px] border-0 bg-cream-200 p-1 shadow-[inset_0_1px_2px_rgba(36,27,20,0.06)] md:hidden">
          <legend className="sr-only">Plan</legend>
          {PLAN_TABS.map((plan, i) => {
            const isActive = i === activePrice;
            return (
              <button
                key={plan}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActivePrice(i)}
                className={`min-h-[38px] rounded-[10px] px-4 py-[9px] text-[13px] font-medium transition-all ${
                  isActive ? "bg-ink text-cream" : "bg-transparent text-muted"
                }`}
              >
                {plan}
              </button>
            );
          })}
        </fieldset>
      </Reveal>

      <div
        ref={gridRef}
        data-active={activePrice}
        className="price-grid grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1.3fr_1fr]"
      >
        <div
          {...cardInteraction(0)}
          className="price-card relative flex flex-col rounded-[24px] bg-ink px-[26px] pb-7 pt-[30px] text-cream shadow-[0_30px_60px_-34px_rgba(36,27,20,0.7)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-cream/[0.62]">
              Individual
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              aria-label="Annual billing"
              onClick={() => setAnnual(!annual)}
              className={`relative h-[28px] w-[88px] flex-none rounded-full text-[11px] font-medium transition-colors ${
                annual ? "bg-teal text-cream" : "bg-cream/[0.18] text-cream/[0.85]"
              }`}
            >
              <span
                className={`flex h-full items-center justify-center transition-[padding] ${
                  annual ? "pr-[22px]" : "pl-[22px]"
                }`}
              >
                {annual ? "Annual" : "Monthly"}
              </span>
              <span
                className={`absolute left-[4px] top-[4px] h-5 w-5 rounded-full bg-cream shadow-[0_1px_3px_rgba(36,27,20,0.35)] transition-transform duration-300 ${
                  annual ? "translate-x-[60px]" : ""
                }`}
              />
            </button>
          </div>
          <div className="mt-[14px] flex items-baseline gap-1">
            <span className="font-display text-[clamp(38px,5.5vw,54px)] font-light leading-none tracking-[-0.03em]">
              ${PRICE[billing]}
            </span>
            <span className="text-[15px] text-cream/60">/mo</span>
          </div>
          <div className="mt-[6px] text-[12px] text-cream/60">
            {annual ? "billed yearly — 1 month free" : "billed monthly"}
          </div>
          <p className="mt-[14px] text-[14px] leading-[1.5] text-cream/[0.78]">
            Everything included — one front desk, set up for you, live in days.
          </p>
          <div className="my-[18px] mt-5 border-t border-cream/[0.14]" />
          <FeatureList feats={PLAN_FEATURES} check="#7FD18F" itemCls="text-cream/[0.92]" />
          <a
            href={`/onboarding?billing=${billing}`}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-cream px-5 py-[14px] text-[15px] font-medium text-ink no-underline"
          >
            Get started
          </a>
        </div>

        <div
          {...cardInteraction(1)}
          className="price-card flex flex-col rounded-[24px] bg-cream-200 px-[26px] pb-7 pt-[30px] text-ink"
        >
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-4">
            Multi-location
          </div>
          <div className="mt-[14px] flex items-baseline gap-1">
            <span className="font-display text-[clamp(30px,4vw,40px)] font-light leading-none tracking-[-0.03em]">
              Custom
            </span>
          </div>
          <div className="mt-[6px] text-[12px] text-muted-2">priced per location</div>
          <p className="mt-[14px] text-[14px] leading-[1.5] text-muted">
            For groups running several front desks.
          </p>
          <div className="my-[18px] mt-5 border-t border-ink/10" />
          <FeatureList feats={MULTI_LOCATION_FEATURES} check="#4F8C80" itemCls="text-[#54493e]" />
          <a
            href={SALES_EMAIL_HREF}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-ink px-5 py-[14px] text-[15px] font-medium text-cream no-underline"
          >
            Talk to sales
          </a>
        </div>
      </div>
    </section>
  );
}
