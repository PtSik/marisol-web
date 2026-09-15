"use client";

import { type Dict, fill } from "@/lib/i18n/dict";
import {
  type Billing,
  PLAN_LABELS,
  PRICE,
  type Plan,
  annualSavingPerYear,
  annualTotal,
} from "@/lib/plans";

export function PlanSummary({
  t,
  pricing,
  plan,
  billing,
  onChange,
}: {
  t: Dict["onboarding"];
  pricing: Dict["pricing"];
  plan: Plan;
  billing: Billing;
  onChange: () => void;
}) {
  const annual = billing === "annual";

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-ink/[0.07] bg-cream-100 px-[18px] py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="t-eyebrow text-muted-4">{t.planSummary}</div>
        <div className="mt-[6px] t-body font-medium text-ink">
          {PLAN_LABELS[plan]} ·{" "}
          {annual
            ? fill(pricing.billedYearly, { total: annualTotal(plan).toLocaleString("en-US") })
            : pricing.billedMonthly}
        </div>
        <div className="mt-[2px] flex flex-wrap items-baseline gap-x-[10px] gap-y-1">
          <span className="t-body text-ink">
            ${PRICE[plan][billing]}
            {pricing.perMonth}
          </span>
          {annual && (
            <>
              <span aria-hidden="true" className="t-body-sm text-muted-3 line-through">
                ${PRICE[plan].monthly}
              </span>
              <span className="sr-only">
                {fill(pricing.wasPrice, { price: PRICE[plan].monthly })}
              </span>
              <span className="t-caption font-medium text-teal">
                {fill(pricing.savePerYear, { amount: annualSavingPerYear(plan) })}
              </span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="min-h-[44px] self-start t-body-sm font-medium text-teal sm:self-center"
      >
        {t.changePlan} →
      </button>
    </div>
  );
}
