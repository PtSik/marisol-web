"use client";

import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { inputCls } from "@/components/onboarding/fieldStyles";
import type { Dict } from "@/lib/i18n/dict";
import { useId, useState } from "react";

export function ResetPasswordForm({ token, t }: { token: string; t: Dict["auth"] }) {
  const idPrefix = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const errs: FieldErrors = {};
    if (password.length < 8) errs.password = t.errPassword;
    if (confirm !== password) errs.confirm = t.errConfirm;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        setServerError(t.resetInvalid);
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setServerError(t.errGeneric);
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <p
        role="alert"
        className="mt-5 rounded-[12px] border border-[#B4452C]/25 bg-[#B4452C]/8 px-4 py-3 text-[13.5px] leading-[1.5] text-[#B4452C]"
      >
        {t.resetInvalid}
      </p>
    );
  }

  if (done) {
    return (
      <div className="mt-5">
        <p className="text-[14.5px] leading-[1.55] text-muted">{t.resetSuccess}</p>
        <a
          href="/login"
          className="mt-6 inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-ink px-6 py-[14px] text-[15px] font-medium text-cream no-underline"
        >
          {t.resetSuccessCta}
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mt-6 flex flex-col gap-4"
    >
      <Field label={t.password} htmlFor={`${idPrefix}-password`} error={errors.password}>
        <input
          id={`${idPrefix}-password`}
          type="password"
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.passwordPlaceholder}
          autoComplete="new-password"
        />
      </Field>
      <Field label={t.confirmPassword} htmlFor={`${idPrefix}-confirm`} error={errors.confirm}>
        <input
          id={`${idPrefix}-confirm`}
          type="password"
          className={inputCls}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t.confirmPasswordPlaceholder}
          autoComplete="new-password"
        />
      </Field>

      {serverError && (
        <p role="alert" className="text-[13.5px] font-medium text-[#B4452C]">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-6 py-[14px] text-[15px] font-medium text-cream disabled:opacity-60"
      >
        {submitting ? t.submitting : t.resetSubmit}
      </button>
    </form>
  );
}
