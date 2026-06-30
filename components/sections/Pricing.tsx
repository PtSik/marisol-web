"use client";

import { Reveal } from "@/components/motion/Reveal";
import { useEffect, useRef, useState } from "react";

const TIERS = [
  {
    name: "Solo",
    mo: 99,
    yr: 91,
    featured: false,
    blurb: "For a single chair or one-person studio.",
    feats: [
      "Up to 200 answered calls / mo",
      "Booking + SMS confirmations",
      "1 calendar, 1 staff member",
      "Keep your current number",
    ],
  },
  {
    name: "Studio",
    mo: 199,
    yr: 182,
    featured: true,
    blurb: "For busy shops with a full book.",
    feats: [
      "Unlimited answered calls",
      "Reschedules & no-show reminders",
      "Multi-staff calendar routing",
      "Custom voice & greeting",
      "Priority email support",
    ],
  },
  {
    name: "Multi-location",
    mo: 499,
    yr: 457,
    featured: false,
    blurb: "For groups running several front desks.",
    feats: [
      "Everything in Studio",
      "Up to 5 locations",
      "Per-location numbers & menus",
      "Call analytics dashboard",
      "Dedicated onboarding",
    ],
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [activePrice, setActivePrice] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const sync = () => {
      if (window.innerWidth >= 768) {
        grid.style.height = "";
        return;
      }
      const cards = grid.querySelectorAll<HTMLElement>(".price-card");
      const card = cards[activePrice];
      if (card) grid.style.height = `${card.offsetHeight}px`;
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [activePrice]);

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
          No per-minute charges, no setup fees. Cancel anytime — keep your number.
        </p>

        <fieldset className="m-0 mt-6 inline-flex items-center gap-1 rounded-[14px] border-0 bg-cream-200 p-1 shadow-[inset_0_1px_2px_rgba(36,27,20,0.06)]">
          <legend className="sr-only">Billing period</legend>
          {(["monthly", "annual"] as const).map((period) => {
            const isActive = (period === "annual") === annual;
            return (
              <button
                key={period}
                type="button"
                aria-pressed={isActive}
                onClick={() => setAnnual(period === "annual")}
                className={`min-h-[38px] rounded-[10px] px-4 py-[9px] text-[13px] font-medium capitalize transition-all ${
                  isActive ? "bg-ink text-cream" : "bg-transparent text-muted"
                }`}
              >
                {period}
              </button>
            );
          })}
        </fieldset>
      </Reveal>

      <div
        ref={gridRef}
        data-active={activePrice}
        className="price-grid grid grid-cols-1 items-stretch gap-4 md:grid-cols-3"
      >
        {TIERS.map((tier, i) => {
          const price = annual ? tier.yr : tier.mo;
          const check = tier.featured ? "#7FD18F" : "#4F8C80";
          return (
            <div
              key={tier.name}
              onClick={() => setActivePrice(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActivePrice(i);
                }
              }}
              className={`price-card relative flex flex-col rounded-[24px] px-[26px] pb-7 pt-[30px] ${
                tier.featured
                  ? "bg-ink text-cream shadow-[0_30px_60px_-34px_rgba(36,27,20,0.7)]"
                  : "bg-cream-200 text-ink"
              }`}
            >
              {tier.featured && (
                <span className="absolute right-[18px] top-[18px] rounded-full bg-teal px-[10px] py-[5px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cream">
                  Most popular
                </span>
              )}
              <div
                className={`text-[11.5px] font-semibold uppercase tracking-[0.14em] ${
                  tier.featured ? "text-cream/[0.62]" : "text-muted-4"
                }`}
              >
                {tier.name}
              </div>
              <div className="mt-[14px] flex items-baseline gap-1">
                <span className="font-display text-[clamp(38px,5.5vw,54px)] font-light leading-none tracking-[-0.03em]">
                  ${price}
                </span>
                <span className={`text-[15px] ${tier.featured ? "text-cream/60" : "text-muted-2"}`}>
                  /mo
                </span>
              </div>
              <div
                className={`mt-[6px] text-[12px] ${tier.featured ? "text-cream/60" : "text-muted-2"}`}
              >
                {annual ? "billed yearly — 1 month free" : "billed monthly"}
              </div>
              <p
                className={`mt-[14px] text-[14px] leading-[1.5] ${
                  tier.featured ? "text-cream/[0.78]" : "text-muted"
                }`}
              >
                {tier.blurb}
              </p>
              <div
                className={`my-[18px] mt-5 border-t ${
                  tier.featured ? "border-cream/[0.14]" : "border-ink/10"
                }`}
              />
              <ul className="mb-[22px] flex flex-1 flex-col gap-[11px]">
                {tier.feats.map((feat) => (
                  <li
                    key={feat}
                    className={`flex items-start gap-[10px] text-[14px] leading-[1.45] ${
                      tier.featured ? "text-cream/[0.92]" : "text-[#54493e]"
                    }`}
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
              <a
                href="#demo"
                className={`inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] px-5 py-[14px] text-[15px] font-medium no-underline ${
                  tier.featured ? "bg-cream text-ink" : "bg-ink text-cream"
                }`}
              >
                Start with {tier.name}
              </a>
            </div>
          );
        })}
      </div>

      <div className="price-dots mt-7 items-center justify-center gap-2">
        {TIERS.map((tier, i) => (
          <button
            key={tier.name}
            type="button"
            aria-label={`Show ${tier.name} plan`}
            onClick={() => setActivePrice(i)}
            className={`h-2 rounded-full transition-all ${
              i === activePrice ? "w-5 bg-ink" : "w-2 bg-ink/25"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
