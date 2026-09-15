"use client";

import { inputCls } from "@/components/onboarding/fieldStyles";
import type { Dict } from "@/lib/i18n/dict";
import { en } from "@/lib/i18n/en";
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
  t = en.callForm,
}: {
  prefill?: CallPrefill;
  onCancel?: () => void;
  t?: Dict["callForm"];
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
    if (!fields.name.trim()) errs.name = t.errName;
    if (!EMAIL_RE.test(fields.email)) errs.email = t.errEmail;
    if (!PHONE_RE.test(fields.phone)) errs.phone = t.errPhone;
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
        <span className="block t-body font-medium text-success">{t.doneTitle}</span>
        <span className="mt-1 block t-body-sm text-muted">{t.doneBody}</span>
      </output>
    );
  }

  return (
    <div className="rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)] text-left text-ink">
      <h3 className="m-0 font-display text-[20px] font-normal tracking-[-0.01em]">{t.title}</h3>
      <p className="mt-1 t-body-sm text-muted">{t.subtitle}</p>

      <div className="mt-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(
            [
              { key: "name", label: t.name, type: "text", autoComplete: "name" },
              { key: "email", label: t.email, type: "email", autoComplete: "email" },
              { key: "phone", label: t.phone, type: "tel", autoComplete: "tel" },
            ] as const
          ).map((f) => (
            <div key={f.key} className="flex flex-col gap-[6px]">
              <label htmlFor={`bc-${f.key}`} className="t-body-sm font-medium text-ink">
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
                <span role="alert" className="t-caption font-medium text-[#B4452C]">
                  {errors[f.key]}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-[6px]">
          <label htmlFor="bc-time" className="t-body-sm font-medium text-ink">
            {t.preferredTime}
          </label>
          <input
            id="bc-time"
            className={inputCls}
            value={fields.preferredTime}
            onChange={(e) => patch({ preferredTime: e.target.value })}
            placeholder={t.preferredTimePlaceholder}
          />
        </div>

        <div className="flex flex-col gap-[6px]">
          <label htmlFor="bc-question" className="t-body-sm font-medium text-ink">
            {t.question}
          </label>
          <textarea
            id="bc-question"
            rows={3}
            className={`${inputCls} min-h-[88px] resize-y`}
            value={fields.question}
            onChange={(e) => patch({ question: e.target.value })}
            placeholder={t.questionPlaceholder}
          />
        </div>

        {submitError && (
          <p role="alert" className="t-body-sm font-medium text-[#B4452C]">
            {t.errSubmit}
          </p>
        )}

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[13px] px-5 py-3 t-body font-medium text-muted"
            >
              {t.cancel}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="btn btn-md btn-primary disabled:opacity-60"
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
