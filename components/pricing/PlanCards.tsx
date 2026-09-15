"use client";

import { type Dict, fill } from "@/lib/i18n/dict";
import {
  type Billing,
  EXTRA_LOCATION_PRICE,
  PLAN_OPTIONS,
  PRICE,
  type Plan,
  TRIAL_DAYS,
  annualSavingPerYear,
  annualTotal,
  maxAnnualSaving,
} from "@/lib/plans";
import type { ReactNode } from "react";

function FeatureList({
  feats,
  check,
  itemCls,
}: { feats: string[]; check: string; itemCls: string }) {
  return (
    <ul className="mb-[22px] flex flex-1 flex-col gap-[9px]">
      {feats.map((feat) => (
        <li key={feat} className={`flex items-start gap-[9px] t-body-sm leading-[1.45] ${itemCls}`}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={check}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-[2px] flex-none"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {feat}
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  t,
  tier,
  billing,
  renderCta,
}: {
  t: Dict["pricing"];
  tier: Plan;
  billing: Billing;
  renderCta: (tier: Plan) => ReactNode;
}) {
  const copy = t.tiers[tier];
  const dark = tier === "complete";
  const annual = billing === "annual";
  const cls = dark
    ? {
        card: "bg-ink text-cream shadow-[0_30px_60px_-34px_rgba(36,27,20,0.7)]",
        label: "text-cream/[0.62]",
        perMonth: "text-cream/60",
        save: "text-[#7FD18F]",
        note: "text-cream/60",
        desc: "text-cream/[0.78]",
        rule: "border-cream/[0.14]",
        check: "#7FD18F",
        item: "text-cream/[0.92]",
      }
    : {
        card: "surface text-ink",
        label: "text-muted-2",
        perMonth: "text-muted-2",
        save: "text-teal",
        note: "text-muted-2",
        desc: "text-muted",
        rule: "border-ink/10",
        check: "#4F8C80",
        item: "text-[#54493e]",
      };

  return (
    <div className={`flex w-full flex-col rounded-[24px] px-[22px] pb-7 pt-[20px] ${cls.card}`}>
      <div className="flex min-h-[26px] items-center justify-between gap-3">
        <div className={`t-eyebrow ${cls.label}`}>{copy.name}</div>
        {dark && (
          <span className="rounded-full bg-teal/25 px-[10px] py-[5px] t-eyebrow text-cream/[0.92]">
            {t.popularTag}
          </span>
        )}
      </div>

      <div className="mt-[14px] flex flex-wrap items-baseline gap-x-[9px] gap-y-1">
        {annual && (
          <span className={`text-[18px] ${cls.note}`}>
            <span aria-hidden="true">≈</span>
            <span className="sr-only">{t.approximate}</span>
          </span>
        )}
        <span className="font-display text-[clamp(32px,3.4vw,42px)] font-bold leading-none tracking-[-0.018em]">
          ${PRICE[tier][billing]}
        </span>
        <span className={`t-body-sm ${cls.perMonth}`}>{t.perMonth}</span>
      </div>
      <div className={`mt-[6px] t-caption ${cls.note}`}>
        {annual
          ? fill(t.billedYearly, { total: annualTotal(tier).toLocaleString("en-US") })
          : t.billedMonthly}
      </div>

      {annual && (
        <p className={`mt-2 t-caption font-medium ${cls.save}`}>
          {fill(t.savePerYear, { amount: annualSavingPerYear(tier) })}
        </p>
      )}

      <p className={`mt-[14px] t-body-sm leading-[1.5] ${cls.desc}`}>{copy.desc}</p>
      <div className={`my-[18px] mt-5 border-t ${cls.rule}`} />
      <FeatureList
        feats={copy.features.map((feat) => fill(feat, { price: EXTRA_LOCATION_PRICE[billing] }))}
        check={cls.check}
        itemCls={cls.item}
      />
      {renderCta(tier)}
    </div>
  );
}

export function PlanCards({
  t,
  billing,
  onBillingChange,
  renderCta,
  detailsHref,
  showTerms = true,
}: {
  t: Dict["pricing"];
  billing: Billing;
  onBillingChange: (billing: Billing) => void;
  detailsHref?: string;
  /** Off inside the checkout picker, where the full cancellation terms are a detour, not a help. */
  showTerms?: boolean;
  renderCta: (tier: Plan) => ReactNode;
}) {
  return (
    <>
      <fieldset className="m-0 inline-flex items-center gap-1 rounded-[14px] border border-ink/[0.07] bg-cream-200 p-1 shadow-[inset_0_1px_2px_rgba(36,27,20,0.06)]">
        <legend className="sr-only">{t.billingLegend}</legend>
        {(["monthly", "annual"] as const).map((period) => {
          const isActive = period === billing;
          return (
            <button
              key={period}
              type="button"
              aria-pressed={isActive}
              onClick={() => onBillingChange(period)}
              className={`min-h-[44px] rounded-[10px] px-4 py-[11px] t-caption font-medium transition-all ${
                isActive ? "bg-ink text-cream" : "bg-transparent text-muted"
              }`}
            >
              {period === "annual" ? fill(t.annual, { amount: maxAnnualSaving() }) : t.monthly}
            </button>
          );
        })}
      </fieldset>

      <div className="mx-auto mt-[clamp(28px,4vw,40px)] grid grid-cols-1 items-stretch gap-4 text-left lg:grid-cols-3">
        {PLAN_OPTIONS.map((tier) => (
          <PlanCard key={tier} t={t} tier={tier} billing={billing} renderCta={renderCta} />
        ))}
      </div>
      <div className="mx-auto mt-5 max-w-[80ch] text-center t-caption leading-[1.55] text-muted-2">
        <p>{fill(t.trialNote, { days: TRIAL_DAYS })}</p>
        {!showTerms ? null : detailsHref ? (
          <a
            href={detailsHref}
            className="mt-1 inline-flex min-h-[44px] items-center text-teal underline underline-offset-4"
          >
            {t.detailsLink}
          </a>
        ) : (
          <p className="mt-2">{t.billingNote}</p>
        )}
        <p className="mt-1 t-caption">{t.smsNote}</p>
      </div>
    </>
  );
}

// Keep location add-ons separate from the three core plans.
export function MultiLocationBand({
  t,
  cta,
  priceNote,
}: { t: Dict["pricing"]; cta: ReactNode; priceNote: string }) {
  const copy = t.multiLocation;
  return (
    <div className="surface mt-[clamp(24px,3vw,34px)] flex flex-col gap-5 rounded-[24px] px-[clamp(20px,3vw,30px)] py-[clamp(20px,2.6vw,26px)] text-left md:flex-row md:items-center md:justify-between md:gap-10">
      <div>
        <div className="t-eyebrow text-muted-2">{copy.name}</div>
        <p className="mt-[10px] t-body leading-[1.5]">{copy.desc}</p>
        <p className="mt-2 t-caption leading-relaxed text-muted">{priceNote}</p>
      </div>
      <div className="flex-none">{cta}</div>
    </div>
  );
}

export const tierCtaLabel = (t: Dict["pricing"], tier: Plan): string =>
  fill(t.tiers[tier].cta, { days: TRIAL_DAYS });
