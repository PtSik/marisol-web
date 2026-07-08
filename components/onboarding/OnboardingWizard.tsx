"use client";

import { BookCallForm } from "@/components/onboarding/BookCallForm";
import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { inputCls } from "@/components/onboarding/fieldStyles";
import {
  type BusinessBasics,
  EMAIL_RE,
  PHONE_RE,
  TIMEZONES,
  VERTICALS,
  type Vertical,
  defaultBasics,
  isBusinessBasics,
} from "@/lib/onboarding";
import { type Billing, PLAN_LABELS, PLAN_OPTIONS, PRICE, type Plan } from "@/lib/plans";
import { track } from "@/lib/track";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "marisol-onboarding";

function validateBasics(basics: BusinessBasics): FieldErrors {
  const errors: FieldErrors = {};
  if (!basics.businessName.trim()) errors.businessName = "Enter your business name.";
  if (!basics.ownerName.trim()) errors.ownerName = "Enter your name.";
  if (!EMAIL_RE.test(basics.email)) errors.email = "Enter a valid email address.";
  if (!PHONE_RE.test(basics.businessPhone)) errors.businessPhone = "Enter a valid phone number.";
  if (!PHONE_RE.test(basics.ownerMobile)) errors.ownerMobile = "Enter a valid mobile number.";
  return errors;
}

export function OnboardingWizard() {
  const [basics, setBasics] = useState<BusinessBasics>(() => defaultBasics());
  const [plan, setPlan] = useState<Plan>("base");
  const [billing, setBilling] = useState<Billing>("monthly");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [cancelled, setCancelled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("plan") === "premium") setPlan("premium");
    if (params.get("billing") === "annual") setBilling("annual");
    if (params.get("cancelled") === "1") setCancelled(true);
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      const parsed = saved
        ? (JSON.parse(saved) as { basics?: unknown; billing?: Billing; plan?: Plan })
        : null;
      if (parsed && isBusinessBasics(parsed.basics)) {
        setBasics(parsed.basics);
        if (params.get("plan") == null && parsed.plan === "premium") setPlan("premium");
        if (params.get("billing") == null && parsed.billing === "annual") setBilling("annual");
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) setBasics((b) => ({ ...b, timezone: tz }));
      }
    } catch {
      /* corrupted storage — start fresh */
    }
    hydrated.current = true;
    track("wizard_step", "basics");
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ basics, billing, plan }));
    } catch {
      /* storage full/blocked — non-fatal */
    }
  }, [basics, billing, plan]);

  const patch = (partial: Partial<BusinessBasics>) => setBasics((b) => ({ ...b, ...partial }));

  const submit = async () => {
    const errs = validateBasics(basics);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "checkout", plan, billing, basics }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? "checkout failed");
      }
      track("checkout_redirect", `${plan}:${billing}`);
      window.location.href = body.url;
    } catch {
      setSubmitError("Something went wrong starting checkout. Please try again.");
      setSubmitting(false);
    }
  };

  const timezones = TIMEZONES.some((tz) => tz.id === basics.timezone)
    ? TIMEZONES
    : [{ id: basics.timezone, label: basics.timezone.replace(/_/g, " ") }, ...TIMEZONES];

  return (
    <div className="mx-auto max-w-[720px] px-[22px] pb-[clamp(48px,7vw,88px)]">
      <div className="mb-7 text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          Get started
        </span>
        <h1 className="mx-auto mt-[18px] max-w-[22ch] font-display text-[clamp(26px,4.4vw,40px)] font-light leading-[1.1] tracking-[-0.03em]">
          Tell us about your shop — we set up the rest.
        </h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-[14.5px] leading-[1.55] text-muted">
          Just the basics now — you'll add hours, services and staff right after checkout.
        </p>
      </div>

      {cancelled && (
        <output className="mb-5 block rounded-[12px] bg-cream-200 px-4 py-3 text-[14px] text-muted">
          Payment was cancelled — your details are saved below whenever you're ready.
        </output>
      )}

      <div className="rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
        <div className="flex flex-col gap-5">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-[10px] text-[13.5px] font-medium text-ink">
              What kind of business is it?
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {VERTICALS.map((v) => {
                const active = basics.vertical === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patch({ vertical: v.id as Vertical })}
                    className={`rounded-[16px] border px-[18px] py-4 text-left transition-all ${
                      active ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white/70 text-ink"
                    }`}
                  >
                    <span className="block text-[15px] font-medium">{v.label}</span>
                    <span
                      className={`mt-1 block text-[13px] leading-[1.45] ${
                        active ? "text-cream/70" : "text-muted"
                      }`}
                    >
                      {v.blurb}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field label="Business name" htmlFor="ob-business" error={errors.businessName}>
            <input
              id="ob-business"
              className={inputCls}
              value={basics.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
              placeholder="Fade District"
              autoComplete="organization"
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Your name" htmlFor="ob-owner" error={errors.ownerName}>
              <input
                id="ob-owner"
                className={inputCls}
                value={basics.ownerName}
                onChange={(e) => patch({ ownerName: e.target.value })}
                placeholder="Alex Rivera"
                autoComplete="name"
              />
            </Field>
            <Field label="Email" htmlFor="ob-email" error={errors.email}>
              <input
                id="ob-email"
                type="email"
                className={inputCls}
                value={basics.email}
                onChange={(e) => patch({ email: e.target.value })}
                placeholder="alex@fadedistrict.com"
                autoComplete="email"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Business phone"
              htmlFor="ob-bizphone"
              error={errors.businessPhone}
              hint="Where we transfer callers who ask for a human."
            >
              <input
                id="ob-bizphone"
                type="tel"
                className={inputCls}
                value={basics.businessPhone}
                onChange={(e) => patch({ businessPhone: e.target.value })}
                placeholder="+1 (555) 210-4890"
                autoComplete="tel"
              />
            </Field>
            <Field
              label="Your mobile"
              htmlFor="ob-mobile"
              error={errors.ownerMobile}
              hint="For urgent escalations only."
            >
              <input
                id="ob-mobile"
                type="tel"
                className={inputCls}
                value={basics.ownerMobile}
                onChange={(e) => patch({ ownerMobile: e.target.value })}
                placeholder="+1 (555) 902-3311"
                autoComplete="tel"
              />
            </Field>
          </div>

          <Field label="Timezone" htmlFor="ob-tz">
            <select
              id="ob-tz"
              className={inputCls}
              value={basics.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
            >
              {timezones.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label}
                </option>
              ))}
            </select>
          </Field>

          <fieldset className="m-0 border-0 p-0 text-center">
            <legend className="sr-only">Plan</legend>
            <div className="inline-flex items-center gap-1 rounded-[14px] bg-cream-200 p-1 shadow-[inset_0_1px_2px_rgba(36,27,20,0.06)]">
              {PLAN_OPTIONS.map((p) => {
                const isActive = p === plan;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setPlan(p)}
                    className={`min-h-[38px] rounded-[10px] px-4 py-[9px] text-[13px] font-medium transition-all ${
                      isActive ? "bg-ink text-cream" : "bg-transparent text-muted"
                    }`}
                  >
                    {PLAN_LABELS[p]} — ${PRICE[p].monthly}/mo
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="m-0 border-0 p-0 text-center">
            <legend className="sr-only">Billing period</legend>
            <div className="inline-flex items-center gap-1 rounded-[14px] bg-cream-200 p-1 shadow-[inset_0_1px_2px_rgba(36,27,20,0.06)]">
              {(["monthly", "annual"] as const).map((period) => {
                const isActive = period === billing;
                return (
                  <button
                    key={period}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setBilling(period)}
                    className={`min-h-[38px] rounded-[10px] px-4 py-[9px] text-[13px] font-medium capitalize transition-all ${
                      isActive ? "bg-ink text-cream" : "bg-transparent text-muted"
                    }`}
                  >
                    {period}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[13px] text-muted-2">
              {billing === "annual"
                ? `$${PRICE[plan].annual}/mo billed yearly — 1 month free`
                : `$${PRICE[plan].monthly}/mo, cancel anytime`}
            </p>
          </fieldset>

          {submitError && (
            <p role="alert" className="text-center text-[13.5px] font-medium text-[#B4452C]">
              {submitError}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href="/#pricing"
            className="inline-flex min-h-[50px] items-center justify-center rounded-[13px] px-5 py-[14px] text-[15px] font-medium text-muted no-underline"
          >
            ← Back to site
          </a>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream disabled:opacity-60"
          >
            {submitting
              ? "Redirecting to Stripe…"
              : `Continue to payment — $${PRICE[plan][billing]}/mo`}
          </button>
        </div>

        <p className="mt-4 text-center text-[13px] leading-[1.55] text-muted-2">
          14-day money-back guarantee — if it's not for you, we refund your first payment, no
          questions. One saved appointment a day more than covers the subscription.
        </p>
      </div>

      <BookCallForm
        prefill={{
          name: basics.ownerName,
          email: basics.email,
          phone: basics.ownerMobile || basics.businessPhone,
        }}
      />
    </div>
  );
}
