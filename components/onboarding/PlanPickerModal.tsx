"use client";

import { Modal } from "@/components/Modal";
import { PlanCards } from "@/components/pricing/PlanCards";
import { type Dict, type Locale, fill } from "@/lib/i18n/dict";
import { type Billing, PLAN_LABELS, type Plan, TRIAL_DAYS } from "@/lib/plans";
import { useId } from "react";

const CTA_CLS: Record<Plan, string> = {
  base: "inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-5 py-[14px] text-[15px] font-medium text-cream",
  premium:
    "inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-cream px-5 py-[14px] text-[15px] font-medium text-ink",
};

export function PlanPickerModal({
  open,
  t,
  locale,
  billing,
  onBillingChange,
  onChoose,
  onDismiss,
}: {
  open: boolean;
  t: Dict["pricing"];
  locale: Locale;
  billing: Billing;
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
      className="relative max-h-[calc(100vh-36px)] w-full max-w-[880px] overflow-y-auto rounded-[20px] border border-ink/10 bg-cream-100 p-[clamp(20px,4vw,34px)] text-center"
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
        className="mx-auto max-w-[18ch] px-10 font-display text-[clamp(24px,4vw,36px)] font-light leading-[1.1] tracking-[-0.03em]"
      >
        {t.pickerTitle}
      </h2>
      <p className="mx-auto mt-[10px] mb-6 max-w-[44ch] text-[14.5px] leading-[1.55] text-muted">
        {fill(t.pickerSubtitle, { days: TRIAL_DAYS })}
      </p>

      <PlanCards
        t={t}
        billing={billing}
        onBillingChange={onBillingChange}
        renderCta={(plan) => (
          <button type="button" onClick={() => onChoose(plan)} className={CTA_CLS[plan]}>
            {fill(t.choosePlan, { plan: PLAN_LABELS[plan] })}
          </button>
        )}
      />

      <button
        type="button"
        onClick={onDismiss}
        className="mt-6 min-h-[40px] text-[13px] font-medium uppercase tracking-[0.1em] text-muted-2"
      >
        {t.pickerDismiss}
      </button>
    </Modal>
  );
}
