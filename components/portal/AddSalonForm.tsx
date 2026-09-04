"use client";

import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { SetupFields, validateSetup } from "@/components/onboarding/SetupFields";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { en } from "@/lib/i18n/en";
import {
  PHONE_RE,
  type SetupDetails,
  TIMEZONE_IDS,
  VERTICAL_IDS,
  type Vertical,
  defaultSetup,
} from "@/lib/onboarding";
import {
  type Billing,
  EXTRA_LOCATION_PRICE,
  PLAN_SALON_LIMIT,
  PRICE,
  type Plan,
  canAddLocation,
} from "@/lib/plans";
import { useState } from "react";

const VERTICAL_LABELS: Record<Vertical, string> = {
  barbershop: "Barbershop / salon",
  grooming: "Pet grooming",
};

type Step = "basics" | "confirm" | "setup";

export function AddSalonForm({
  plan,
  billing,
  activeSalons,
  defaultVertical,
  defaultTimezone,
}: {
  plan: Plan;
  billing: Billing;
  activeSalons: number;
  defaultVertical: Vertical;
  defaultTimezone: string;
}) {
  const [step, setStep] = useState<Step>("basics");
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [vertical, setVertical] = useState<Vertical>(defaultVertical);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [setup, setSetup] = useState<SetupDetails>(() =>
    defaultSetup(defaultVertical, en.setup.servicePresets[defaultVertical]),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // Adding this salon pushes the account one past what its plan covers whenever it's already at the
  // limit — that's the location that starts costing the extra-location rate.
  const willBillExtra = activeSalons >= PLAN_SALON_LIMIT[plan];

  const submitBasics = () => {
    const errs: FieldErrors = {};
    if (!businessName.trim()) errs.businessName = "Enter the salon's name.";
    if (!PHONE_RE.test(businessPhone)) errs.businessPhone = "Enter a valid phone number.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSetup(defaultSetup(vertical, en.setup.servicePresets[vertical]));
    setStep("confirm");
  };

  const submitAll = async () => {
    const errs = validateSetup(setup, en.setup);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch("/api/portal/add-salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, businessPhone, timezone, vertical, setup }),
      });
      if (res.ok) {
        window.location.assign("/portal/salons?added=pending");
        return;
      }
    } catch {
      /* fall through to the failure notice */
    }
    setFailed(true);
    setSaving(false);
  };

  if (!canAddLocation(plan)) {
    return (
      <div className="rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
        <p className="font-display text-[clamp(20px,3vw,26px)] tracking-[-0.02em]">Add a salon</p>
        <p className="mt-2 max-w-[54ch] text-[15px] leading-[1.55] text-muted">
          Extra locations start on Complete (${PRICE.complete[billing]}/mo). Move up on the Billing
          page and each additional salon is +${EXTRA_LOCATION_PRICE[billing]}/mo on the same
          subscription.
        </p>
        <a
          href="/portal/billing"
          className="mt-6 inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream no-underline"
        >
          See upgrade options
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
      {step === "basics" && (
        <>
          <p className="font-display text-[clamp(20px,3vw,26px)] tracking-[-0.02em]">Add a salon</p>
          <p className="mt-1.5 text-[14px] leading-[1.5] text-muted">
            Just what's different about this location — everything else comes from your account.
          </p>

          <div className="mt-6 grid gap-5">
            <Field label="Salon name" htmlFor="add-name" error={errors.businessName}>
              <input
                id="add-name"
                className={inputCls}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </Field>
            <Field
              label="Salon phone"
              htmlFor="add-phone"
              hint="The number clients call today — we pick a local Marisol number near it."
              error={errors.businessPhone}
            >
              <input
                id="add-phone"
                className={inputCls}
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
              />
            </Field>
            <Field label="Type of business" htmlFor="add-vertical">
              <select
                id="add-vertical"
                className={inputCls}
                value={vertical}
                onChange={(e) => setVertical(e.target.value as Vertical)}
              >
                {VERTICAL_IDS.map((v) => (
                  <option key={v} value={v}>
                    {VERTICAL_LABELS[v]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Time zone" htmlFor="add-timezone">
              <select
                id="add-timezone"
                className={`${inputCls} max-w-[420px]`}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONE_IDS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="button"
            onClick={submitBasics}
            className="mt-7 inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream sm:w-auto"
          >
            Continue
          </button>
        </>
      )}

      {step === "confirm" && (
        <>
          <p className="font-display text-[clamp(20px,3vw,26px)] tracking-[-0.02em]">
            {willBillExtra ? `+$${EXTRA_LOCATION_PRICE[billing]}/mo` : "No extra charge"}
          </p>
          <p className="mt-2 max-w-[54ch] text-[15px] leading-[1.55] text-muted">
            {willBillExtra
              ? `After our setup review, it will be added to your current subscription and prorated to the days left in this ${
                  billing === "annual" ? "year" : "month"
                }. One invoice, one card, one place to cancel.`
              : "Your plan already covers this location — nothing new is charged. We'll review the setup before activation."}
          </p>

          {failed && (
            <p className="mt-4 text-[14px] font-medium text-red-700">
              That didn't go through. Try again, or email us and we'll set it up.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep("setup")}
              className="inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream"
            >
              Set up this salon
            </button>
            <button
              type="button"
              onClick={() => setStep("basics")}
              className="inline-flex min-h-[50px] items-center justify-center rounded-[13px] border border-ink/15 px-7 py-[14px] text-[15px] font-medium"
            >
              Back
            </button>
          </div>
        </>
      )}

      {step === "setup" && (
        <>
          <p className="font-display text-[clamp(20px,3vw,26px)] tracking-[-0.02em]">
            Set up {businessName || "your salon"}
          </p>
          <p className="mt-1.5 text-[14px] leading-[1.5] text-muted">
            Hours, services, staff and forwarding for this location.
          </p>

          <div className="mt-6">
            <SetupFields
              setup={setup}
              vertical={vertical}
              errors={errors}
              t={en.setup}
              locale="en"
              patch={(partial) => setSetup((s) => ({ ...s, ...partial }))}
            />
          </div>

          {failed && (
            <p className="mt-4 text-[14px] font-medium text-red-700">
              That didn't go through. Try again, or email us and we'll set it up.
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submitAll}
              disabled={saving}
              className="inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-teal px-7 py-[14px] text-[15px] font-medium text-cream disabled:opacity-60"
            >
              {saving
                ? "Setting up…"
                : willBillExtra
                  ? `Add salon — +$${EXTRA_LOCATION_PRICE[billing]}/mo`
                  : "Add salon"}
            </button>
            <button
              type="button"
              onClick={() => setStep("confirm")}
              disabled={saving}
              className="inline-flex min-h-[50px] items-center justify-center rounded-[13px] border border-ink/15 px-7 py-[14px] text-[15px] font-medium"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
