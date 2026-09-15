"use client";

import { Modal } from "@/components/Modal";
import { PlanCards } from "@/components/pricing/PlanCards";
import { type Dict, type Locale, fill } from "@/lib/i18n/dict";
import { type Billing, type Plan, TRIAL_DAYS } from "@/lib/plans";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { useId } from "react";

// Same recipe as the landing's pricing section, which renders the same `PlanCards`.
const ctaCls = (tier: Plan): string =>
  tier === "complete" ? "btn btn-md btn-on-dark" : "btn btn-md btn-primary";

export function PlanPickerModal({
  open,
  t,
  locale,
  billing,
  selected,
  onBillingChange,
  onChoose,
  onDismiss,
}: {
  open: boolean;
  t: Dict["pricing"];
  locale: Locale;
  billing: Billing;
  /** The tier the customer actually chose — from a pricing card or an earlier visit to this
   * picker. `null` when they arrived through "Start free trial" and have picked nothing yet. */
  selected: Plan | null;
  onBillingChange: (billing: Billing) => void;
  onChoose: (plan: Plan) => void;
  onDismiss: () => void;
}) {
  const titleId = useId();

  return (
    <Modal
      open={open}
      onClose={onDismiss}
      labelledBy={titleId}
      locale={locale}
      className="relative max-h-[calc(100dvh-36px)] w-full max-w-[1000px] overflow-y-auto rounded-[20px] border border-ink/10 bg-cream-100 p-[clamp(20px,4vw,34px)] text-center"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t.pickerClose}
        className="absolute right-[14px] top-[14px] flex h-9 w-9 items-center justify-center rounded-full text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <h2
        id={titleId}
        className="mx-auto max-w-[18ch] px-10 font-display t-h3 font-bold text-balance"
      >
        {t.pickerTitle}
      </h2>
      <p className="mx-auto mt-[10px] mb-6 max-w-[44ch] t-body-sm text-muted">
        {fill(t.pickerSubtitle, { days: TRIAL_DAYS })}
      </p>

      <PlanCards
        t={t}
        billing={billing}
        onBillingChange={onBillingChange}
        showTerms={false}
        renderCta={(tier) => (
          <button
            type="button"
            onClick={() => onChoose(tier)}
            aria-current={tier === selected ? "true" : undefined}
            className={`${ctaCls(tier)} ${tier === selected ? "ring-2 ring-teal ring-offset-2 ring-offset-transparent" : ""}`}
          >
            {tier === selected
              ? fill(t.keepPlan, { plan: t.tiers[tier].name })
              : fill(t.choosePlan, { plan: t.tiers[tier].name })}
          </button>
        )}
      />

      <p className="mt-5 t-caption text-muted-2">
        {t.locationsNote}
        <a href={SALES_EMAIL_HREF} className="text-ink underline">
          {t.salesLink}
        </a>
        .
      </p>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 min-h-[40px] t-caption font-medium uppercase tracking-[0.1em] text-muted-2"
      >
        {t.pickerDismiss}
      </button>
    </Modal>
  );
}
