"use client";

import { GoogleGlyph } from "@/components/GoogleGlyph";
import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { inputCls } from "@/components/onboarding/fieldStyles";
import type { Dict, Locale } from "@/lib/i18n/dict";
import { EMAIL_RE } from "@/lib/onboarding";
import type { Billing, Plan } from "@/lib/plans";
import { APP_URL } from "@/lib/site";
import { useEffect, useId, useRef, useState } from "react";

export type AuthTab = "signup" | "signin";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function errorFromStatus(status: number, t: Dict["auth"]): string {
  if (status === 429) return t.errRateLimited;
  if (status === 401) return t.errInvalidCredentials;
  if (status === 409) return t.errEmailTaken;
  return t.errGeneric;
}

async function postJson(
  url: string,
  body: unknown,
): Promise<{ status: number; redirect?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { redirect?: string };
  return { status: res.status, redirect: data.redirect };
}

// Carries the plan/billing the client picked on the pricing card through to the dashboard, in the
// same `?plan=&billing=` shape the authed Pricing CTA already links with.
function goToApp(redirect: string, plan?: Plan, billing?: Billing) {
  const url = new URL(redirect, APP_URL);
  if (plan) url.searchParams.set("plan", plan);
  if (billing) url.searchParams.set("billing", billing);
  window.location.href = url.toString();
}

function SignupForm({ t, plan, billing }: { t: Dict["auth"]; plan?: Plan; billing?: Billing }) {
  const idPrefix = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async () => {
    const errs: FieldErrors = {};
    if (!EMAIL_RE.test(email)) errs.email = t.errEmail;
    if (password.length < 8) errs.password = t.errPassword;
    if (confirm !== password) errs.confirm = t.errConfirm;
    if (!terms) errs.terms = t.errTerms;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const { status, redirect } = await postJson("/api/auth/password/register", {
        email,
        password,
        confirm,
        terms,
      });
      if (!redirect) {
        setServerError(errorFromStatus(status, t));
        setSubmitting(false);
        return;
      }
      goToApp(redirect, plan, billing);
    } catch {
      setServerError(t.errGeneric);
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <Field label={t.email} htmlFor={`${idPrefix}-email`} error={errors.email}>
        <input
          id={`${idPrefix}-email`}
          type="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          autoComplete="email"
        />
      </Field>
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

      <div className="flex flex-col gap-[6px]">
        <label className="flex items-start gap-[10px] text-[13.5px] leading-[1.45] text-ink">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-[3px] h-4 w-4 shrink-0 rounded-[4px] border-ink/25"
          />
          <span>
            {t.termsBefore}
            <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-teal">
              {t.termsLink}
            </a>
            {t.termsAnd}
            <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-teal">
              {t.privacyLink}
            </a>
          </span>
        </label>
        {errors.terms && (
          <span role="alert" className="text-[12.5px] font-medium text-[#B4452C]">
            {errors.terms}
          </span>
        )}
      </div>

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
        {submitting ? t.submitting : t.submitSignup}
      </button>
    </form>
  );
}

function ForgotPassword({ t, onBack }: { t: Dict["auth"]; onBack: () => void }) {
  const idPrefix = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email)) {
      setError(t.errEmail);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await fetch("/api/auth/password/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-[1.55] text-muted">{t.resetSent}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[13px] border border-ink/15 px-5 py-3 text-[14px] font-medium text-ink"
        >
          {t.backToSignIn}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-[13.5px] leading-[1.5] text-muted">{t.forgotSubtitle}</p>
      <Field label={t.email} htmlFor={`${idPrefix}-forgot-email`} error={error ?? undefined}>
        <input
          id={`${idPrefix}-forgot-email`}
          type="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          autoComplete="email"
        />
      </Field>
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-6 py-[14px] text-[15px] font-medium text-cream disabled:opacity-60"
        >
          {submitting ? t.submitting : t.sendResetLink}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[40px] items-center justify-center text-[13.5px] font-medium text-muted"
        >
          {t.backToSignIn}
        </button>
      </div>
    </form>
  );
}

function SigninForm({
  t,
  plan,
  billing,
  onForgot,
}: { t: Dict["auth"]; plan?: Plan; billing?: Billing; onForgot: () => void }) {
  const idPrefix = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async () => {
    const errs: FieldErrors = {};
    if (!EMAIL_RE.test(email)) errs.email = t.errEmail;
    if (!password) errs.password = t.errInvalidCredentials;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const { status, redirect } = await postJson("/api/auth/password/login", { email, password });
      if (!redirect) {
        setServerError(errorFromStatus(status, t));
        setSubmitting(false);
        return;
      }
      goToApp(redirect, plan, billing);
    } catch {
      setServerError(t.errGeneric);
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <Field label={t.email} htmlFor={`${idPrefix}-email`} error={errors.email}>
        <input
          id={`${idPrefix}-email`}
          type="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          autoComplete="email"
        />
      </Field>
      <Field label={t.password} htmlFor={`${idPrefix}-password`} error={errors.password}>
        <input
          id={`${idPrefix}-password`}
          type="password"
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.passwordPlaceholder}
          autoComplete="current-password"
        />
      </Field>

      <button
        type="button"
        onClick={onForgot}
        className="self-start text-[13px] font-medium text-teal"
      >
        {t.forgotPassword}
      </button>

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
        {submitting ? t.submitting : t.submitSignin}
      </button>
    </form>
  );
}

export function AuthModal({
  open,
  tab,
  plan,
  billing,
  onTabChange,
  onClose,
  t,
  locale,
}: {
  open: boolean;
  tab: AuthTab;
  plan?: Plan;
  billing?: Billing;
  onTabChange: (tab: AuthTab) => void;
  onClose: () => void;
  t: Dict["auth"];
  locale: Locale;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const titleId = useId();

  // Reset the forgot-password sub-view whenever the modal is reopened — tab switches reset it via
  // the pill buttons' own onClick below, since they already own the tab change.
  useEffect(() => {
    if (open) setForgotOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-[18px]">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        // biome-ignore lint/a11y/useSemanticElements: native <dialog>'s built-in focus trap/top-layer would conflict with the manual trap below
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        lang={locale}
        className="relative max-h-[calc(100vh-36px)] w-full max-w-[420px] overflow-y-auto rounded-[20px] border border-ink/10 bg-cream-100 p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="inline-flex items-center gap-1 rounded-[12px] bg-cream-200 p-1">
            {(["signup", "signin"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => {
                  setForgotOpen(false);
                  onTabChange(value);
                }}
                className={`min-h-[36px] rounded-[9px] px-4 py-[8px] text-[13px] font-medium transition-all ${
                  tab === value ? "bg-ink text-cream" : "bg-transparent text-muted"
                }`}
              >
                {value === "signup" ? t.tabSignup : t.tabSignin}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
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
        </div>

        <h2 id={titleId} className="mt-5 font-display text-[24px] font-light tracking-[-0.02em]">
          {forgotOpen ? t.forgotTitle : tab === "signup" ? t.signupTitle : t.signinTitle}
        </h2>
        {!forgotOpen && (
          <p className="mt-1 text-[13.5px] leading-[1.5] text-muted">
            {tab === "signup" ? t.signupSubtitle : t.signinSubtitle}
          </p>
        )}

        {forgotOpen ? (
          <div className="mt-6">
            <ForgotPassword t={t} onBack={() => setForgotOpen(false)} />
          </div>
        ) : (
          <>
            <a
              href="/api/auth/google/start?intent=login"
              className="mt-6 inline-flex min-h-[50px] w-full items-center justify-center gap-[10px] rounded-[13px] border border-ink/15 bg-white px-6 py-[14px] text-[15px] font-medium text-ink no-underline"
            >
              <GoogleGlyph />
              {t.google}
            </a>

            <div className="my-5 flex items-center gap-3 text-[12px] uppercase tracking-[0.1em] text-muted-3">
              <span className="h-px flex-1 bg-ink/10" />
              {t.or}
              <span className="h-px flex-1 bg-ink/10" />
            </div>

            {tab === "signup" ? (
              <>
                <SignupForm t={t} plan={plan} billing={billing} />
                <p className="mt-5 text-center text-[13px] leading-[1.55] text-muted-2">
                  {t.hasAccount}
                  <button
                    type="button"
                    onClick={() => onTabChange("signin")}
                    className="font-medium text-teal"
                  >
                    {t.signInLink}
                  </button>
                </p>
              </>
            ) : (
              <>
                <SigninForm
                  t={t}
                  plan={plan}
                  billing={billing}
                  onForgot={() => setForgotOpen(true)}
                />
                <p className="mt-5 text-center text-[13px] leading-[1.55] text-muted-2">
                  {t.noAccount}
                  <button
                    type="button"
                    onClick={() => onTabChange("signup")}
                    className="font-medium text-teal"
                  >
                    {t.signUpLink}
                  </button>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
