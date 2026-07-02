"use client";

import { inputCls } from "@/components/onboarding/fieldStyles";
import { EMAIL_RE, PHONE_RE } from "@/lib/onboarding";
import { useState } from "react";

export interface CallPrefill {
  name: string;
  email: string;
  phone: string;
}

interface CallFields extends CallPrefill {
  preferredTime: string;
  question: string;
}

type Errors = Partial<Record<keyof CallFields, string>>;

export function CallRequestForm({
  prefill,
  onCancel,
}: {
  prefill?: CallPrefill;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState<CallFields>({
    name: prefill?.name ?? "",
    email: prefill?.email ?? "",
    phone: prefill?.phone ?? "",
    preferredTime: "",
    question: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const patch = (partial: Partial<CallFields>) => setFields((f) => ({ ...f, ...partial }));

  const submit = async () => {
    const errs: Errors = {};
    if (!fields.name.trim()) errs.name = "Enter your name.";
    if (!EMAIL_RE.test(fields.email)) errs.email = "Enter a valid email address.";
    if (!PHONE_RE.test(fields.phone)) errs.phone = "Enter a valid phone number.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setSubmitError(false);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "call", call: fields }),
      });
      if (!res.ok) throw new Error("request failed");
      setDone(true);
    } catch {
      setSubmitError(true);
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <output className="block rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)] text-center">
        <span className="block text-[15px] font-medium text-success">
          Thanks — we got your request.
        </span>
        <span className="mt-1 block text-[14px] text-muted">
          We'll email you within one business day to schedule your call.
        </span>
      </output>
    );
  }

  return (
    <div className="rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)] text-left text-ink">
      <h3 className="m-0 font-display text-[20px] font-normal tracking-[-0.01em]">
        Book a 15-min call
      </h3>
      <p className="mt-1 text-[13.5px] text-muted">
        No payment needed — we'll reach out to find a time that works.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(
            [
              { key: "name", label: "Your name", type: "text", autoComplete: "name" },
              { key: "email", label: "Email", type: "email", autoComplete: "email" },
              { key: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
            ] as const
          ).map((f) => (
            <div key={f.key} className="flex flex-col gap-[6px]">
              <label htmlFor={`bc-${f.key}`} className="text-[13.5px] font-medium text-ink">
                {f.label}
              </label>
              <input
                id={`bc-${f.key}`}
                type={f.type}
                autoComplete={f.autoComplete}
                className={inputCls}
                value={fields[f.key]}
                onChange={(e) => patch({ [f.key]: e.target.value })}
              />
              {errors[f.key] && (
                <span role="alert" className="text-[12.5px] font-medium text-[#B4452C]">
                  {errors[f.key]}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-[6px]">
          <label htmlFor="bc-time" className="text-[13.5px] font-medium text-ink">
            Preferred time (optional)
          </label>
          <input
            id="bc-time"
            className={inputCls}
            value={fields.preferredTime}
            onChange={(e) => patch({ preferredTime: e.target.value })}
            placeholder="Weekday afternoons, after 2pm ET…"
          />
        </div>

        <div className="flex flex-col gap-[6px]">
          <label htmlFor="bc-question" className="text-[13.5px] font-medium text-ink">
            Your question (optional)
          </label>
          <textarea
            id="bc-question"
            rows={3}
            className={`${inputCls} min-h-[88px] resize-y`}
            value={fields.question}
            onChange={(e) => patch({ question: e.target.value })}
            placeholder="Anything you'd like to know before getting started…"
          />
        </div>

        {submitError && (
          <p role="alert" className="text-[13.5px] font-medium text-[#B4452C]">
            Something went wrong sending your request. Please try again.
          </p>
        )}

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[13px] px-5 py-3 text-[15px] font-medium text-muted"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex min-h-[48px] items-center justify-center rounded-[13px] bg-ink px-6 py-3 text-[15px] font-medium text-cream disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Request a call"}
          </button>
        </div>
      </div>
    </div>
  );
}
