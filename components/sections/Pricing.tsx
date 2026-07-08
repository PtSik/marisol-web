"use client";

import { Reveal } from "@/components/motion/Reveal";
import { BASE_FEATURES, PREMIUM_FEATURES, PRICE } from "@/lib/plans";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { useState } from "react";

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
  const billing = annual ? "annual" : "monthly";

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
          Two plans. <span className="text-teal">Every call</span> answered.
        </h2>
        <p className="mx-auto mt-[14px] max-w-[46ch] text-[15.5px] leading-[1.55] text-muted">
          Flat monthly pricing — no per-minute charges, no setup fees. Cancel anytime, keep your
          number.
        </p>

        <fieldset className="m-0 mt-6 inline-flex items-center gap-1 rounded-[14px] border-0 bg-cream-200 p-1 shadow-[inset_0_1px_2px_rgba(36,27,20,0.06)]">
          <legend className="sr-only">Billing period</legend>
          {(["monthly", "annual"] as const).map((period) => {
            const isActive = period === billing;
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
                {period === "annual" ? "Annual — 1 month free" : "Monthly"}
              </button>
            );
          })}
        </fieldset>
      </Reveal>

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_1.3fr]">
        <div className="order-2 mx-auto flex w-full max-w-[460px] flex-col rounded-[24px] bg-cream-200 px-[26px] pb-7 pt-[20px] text-ink md:order-1 md:max-w-none">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-4">
            Base
          </div>
          <div className="mt-[14px] flex items-baseline gap-1">
            <span className="font-display text-[clamp(34px,4.5vw,46px)] font-light leading-none tracking-[-0.03em]">
              ${PRICE.base[billing]}
            </span>
            <span className="text-[15px] text-muted-2">/mo</span>
          </div>
          <div className="mt-[6px] text-[12px] text-muted-2">
            {annual ? "billed yearly — 1 month free" : "billed monthly"}
          </div>
          <p className="mt-[14px] text-[14px] leading-[1.5] text-muted">
            Your front desk, set up for you — every call answered and booked.
          </p>
          <div className="my-[18px] mt-5 border-t border-ink/10" />
          <FeatureList feats={BASE_FEATURES} check="#4F8C80" itemCls="text-[#54493e]" />
          <a
            href={`/onboarding?plan=base&billing=${billing}`}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-ink px-5 py-[14px] text-[15px] font-medium text-cream no-underline"
          >
            Get started
          </a>
        </div>

        <div className="order-1 mx-auto flex w-full max-w-[460px] flex-col rounded-[24px] bg-ink px-[26px] pb-7 pt-[20px] text-cream shadow-[0_30px_60px_-34px_rgba(36,27,20,0.7)] md:order-2 md:max-w-none">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-cream/[0.62]">
              Premium
            </div>
            <span className="rounded-full bg-teal/25 px-[10px] py-[5px] text-[11px] font-medium text-cream/[0.92]">
              Fewer no-shows
            </span>
          </div>
          <div className="mt-[14px] flex items-baseline gap-1">
            <span className="font-display text-[clamp(38px,5.5vw,54px)] font-light leading-none tracking-[-0.03em]">
              ${PRICE.premium[billing]}
            </span>
            <span className="text-[15px] text-cream/60">/mo</span>
          </div>
          <div className="mt-[6px] text-[12px] text-cream/60">
            {annual ? "billed yearly — 1 month free" : "billed monthly"}
          </div>
          <p className="mt-[14px] text-[14px] leading-[1.5] text-cream/[0.78]">
            Fills your calendar back up — reminders, rebooking and your own branded receptionist.
          </p>
          <div className="my-[18px] mt-5 border-t border-cream/[0.14]" />
          <FeatureList feats={PREMIUM_FEATURES} check="#7FD18F" itemCls="text-cream/[0.92]" />
          <a
            href={`/onboarding?plan=premium&billing=${billing}`}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-cream px-5 py-[14px] text-[15px] font-medium text-ink no-underline"
          >
            Get Premium
          </a>
        </div>
      </div>

      <p className="mt-6 text-center text-[13px] leading-[1.55] text-muted-2">
        14-day money-back guarantee on both plans. Running 3+ locations?{" "}
        <a href={SALES_EMAIL_HREF} className="text-ink underline">
          Talk to sales
        </a>
        .
      </p>
    </section>
  );
}
