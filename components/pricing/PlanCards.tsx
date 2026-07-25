"use client";

import { type Dict, fill } from "@/lib/i18n/dict";
import {
  type Billing,
  PRICE,
  type Plan,
  annualSavingPerYear,
  maxAnnualSaving,
  premiumSaving,
} from "@/lib/plans";
import type { ReactNode } from "react";

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

function PriceBlock({
  t,
  plan,
  billing,
  amountCls,
  perMonthCls,
  wasCls,
  saveCls,
  noteCls,
}: {
  t: Dict["pricing"];
  plan: Plan;
  billing: Billing;
  amountCls: string;
  perMonthCls: string;
  wasCls: string;
  saveCls: string;
  noteCls: string;
}) {
  const annual = billing === "annual";
  return (
    <>
      <div className="mt-[14px] flex flex-wrap items-baseline gap-x-[10px] gap-y-1">
        <span className={amountCls}>${PRICE[plan][billing]}</span>
        <span className={perMonthCls}>{t.perMonth}</span>
        {annual && (
          <>
            {/* Decorative — read flat, a screen reader would announce a number contradicting the
                live price, so the sr-only line below carries the meaning instead. */}
            <span aria-hidden="true" className={`line-through ${wasCls}`}>
              ${PRICE[plan].monthly}
            </span>
            <span className="sr-only">{fill(t.wasPrice, { price: PRICE[plan].monthly })}</span>
            <span className={saveCls}>
              {fill(t.savePerYear, { amount: annualSavingPerYear(plan) })}
            </span>
          </>
        )}
      </div>
      <div className={noteCls}>{annual ? t.billedYearly : t.billedMonthly}</div>
    </>
  );
}

export function PlanCards({
  t,
  billing,
  onBillingChange,
  renderCta,
}: {
  t: Dict["pricing"];
  billing: Billing;
  onBillingChange: (billing: Billing) => void;
  renderCta: (plan: Plan) => ReactNode;
}) {
  return (
    <>
      <fieldset className="m-0 inline-flex items-center gap-1 rounded-[14px] border-0 bg-cream-200 p-1 shadow-[inset_0_1px_2px_rgba(36,27,20,0.06)]">
        <legend className="sr-only">{t.billingLegend}</legend>
        {(["monthly", "annual"] as const).map((period) => {
          const isActive = period === billing;
          return (
            <button
              key={period}
              type="button"
              aria-pressed={isActive}
              onClick={() => onBillingChange(period)}
              className={`min-h-[38px] rounded-[10px] px-4 py-[9px] text-[13px] font-medium transition-all ${
                isActive ? "bg-ink text-cream" : "bg-transparent text-muted"
              }`}
            >
              {period === "annual" ? fill(t.annual, { amount: maxAnnualSaving() }) : t.monthly}
            </button>
          );
        })}
      </fieldset>

      <div className="mt-[clamp(28px,4vw,40px)] grid grid-cols-1 items-stretch gap-4 text-left md:grid-cols-[1fr_1.3fr]">
        <div className="order-2 mx-auto flex w-full max-w-[460px] flex-col rounded-[24px] bg-cream-200 px-[26px] pb-7 pt-[20px] text-ink md:order-1 md:max-w-none">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-4">
            {t.baseName}
          </div>
          <PriceBlock
            t={t}
            plan="base"
            billing={billing}
            amountCls="font-display text-[clamp(34px,4.5vw,46px)] font-light leading-none tracking-[-0.03em]"
            perMonthCls="text-[15px] text-muted-2"
            wasCls="text-[15px] text-muted-3"
            saveCls="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-teal"
            noteCls="mt-[6px] text-[12px] text-muted-2"
          />
          <p className="mt-[14px] text-[14px] leading-[1.5] text-muted">{t.baseDesc}</p>
          <div className="my-[18px] mt-5 border-t border-ink/10" />
          <FeatureList feats={t.baseFeatures} check="#4F8C80" itemCls="text-[#54493e]" />
          {renderCta("base")}
        </div>

        <div className="order-1 mx-auto flex w-full max-w-[460px] flex-col rounded-[24px] bg-ink px-[26px] pb-7 pt-[20px] text-cream shadow-[0_30px_60px_-34px_rgba(36,27,20,0.7)] md:order-2 md:max-w-none">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-cream/[0.62]">
              {t.premiumName}
            </div>
            <span className="rounded-full bg-teal/25 px-[10px] py-[5px] text-[11px] font-medium text-cream/[0.92]">
              {t.premiumTag}
            </span>
          </div>
          <PriceBlock
            t={t}
            plan="premium"
            billing={billing}
            amountCls="font-display text-[clamp(38px,5.5vw,54px)] font-light leading-none tracking-[-0.03em]"
            perMonthCls="text-[15px] text-cream/60"
            wasCls="text-[15px] text-cream/45"
            saveCls="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#7FD18F]"
            noteCls="mt-[6px] text-[12px] text-cream/60"
          />
          <p className="mt-[14px] text-[14px] leading-[1.5] text-cream/[0.78]">{t.premiumDesc}</p>
          <div className="my-[18px] mt-5 border-t border-cream/[0.14]" />
          <FeatureList
            feats={t.premiumFeatures.map((feat) => fill(feat, { saving: premiumSaving(billing) }))}
            check="#7FD18F"
            itemCls="text-cream/[0.92]"
          />
          {renderCta("premium")}
        </div>
      </div>
    </>
  );
}
