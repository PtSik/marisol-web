"use client";

import { type Dict, fill } from "@/lib/i18n/dict";
import { type Billing, PLAN_LABELS, PRICE, type Plan, annualSavingPerYear } from "@/lib/plans";

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
    <div className="flex flex-col gap-3 rounded-[16px] border border-ink/12 bg-white/70 px-[18px] py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-4">
          {t.planSummary}
        </div>
        <div className="mt-[6px] text-[15px] font-medium text-ink">
          {PLAN_LABELS[plan]} · {annual ? pricing.billedYearly : pricing.billedMonthly}
        </div>
        <div className="mt-[2px] flex flex-wrap items-baseline gap-x-[10px] gap-y-1">
          <span className="text-[15px] text-ink">
            ${PRICE[plan][billing]}
            {pricing.perMonth}
          </span>
          {annual && (
            <>
              <span aria-hidden="true" className="text-[13.5px] text-muted-3 line-through">
                ${PRICE[plan].monthly}
              </span>
              <span className="sr-only">
                {fill(pricing.wasPrice, { price: PRICE[plan].monthly })}
              </span>
              <span className="text-[12.5px] font-medium text-teal">
                {fill(pricing.savePerYear, { amount: annualSavingPerYear(plan) })}
              </span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="self-start rounded-[10px] text-[13.5px] font-medium text-teal sm:self-center"
      >
        {t.changePlan} →
      </button>
    </div>
  );
}
