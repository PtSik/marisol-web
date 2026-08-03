"use client";

import { BookCallForm } from "@/components/onboarding/BookCallForm";
import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { PlanPickerModal } from "@/components/onboarding/PlanPickerModal";
import { PlanSummary } from "@/components/onboarding/PlanSummary";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { type Dict, type Locale, fill, getDict } from "@/lib/i18n/dict";
import {
  type BusinessBasics,
  PHONE_RE,
  TIMEZONE_IDS,
  VERTICAL_IDS,
  type Vertical,
  coerceTimezone,
  defaultBasics,
  isBusinessBasics,
  isTimezoneId,
} from "@/lib/onboarding";
import { type Billing, PLAN_OPTIONS, PRICE, type Plan, TRIAL_DAYS } from "@/lib/plans";
import { track } from "@/lib/track";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "marisol-onboarding";

interface StoredWizard {
  basics?: unknown;
  billing?: Billing;
  plan?: Plan;
  // Explicit, because a stored basic/annual pair is indistinguishable from the untouched defaults.
  planChosen?: boolean;
}

const isPlan = (value: unknown): value is Plan => PLAN_OPTIONS.some((plan) => plan === value);
const isBilling = (value: unknown): value is Billing => value === "monthly" || value === "annual";

// A save from before the US-only rule can hold any zone string. That is worth a fallback, not a
// discarded form — the owner's typed name and numbers are in the same record.
function storedBasics(value: unknown): BusinessBasics | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = { ...value, timezone: coerceTimezone((value as BusinessBasics).timezone) };
  return isBusinessBasics(candidate) ? candidate : null;
}

function validateBasics(basics: BusinessBasics, t: Dict["onboarding"]): FieldErrors {
  const errors: FieldErrors = {};
  if (!basics.businessName.trim()) errors.businessName = t.errBusinessName;
  if (!basics.ownerName.trim()) errors.ownerName = t.errOwnerName;
  if (!PHONE_RE.test(basics.businessPhone)) errors.businessPhone = t.errBusinessPhone;
  if (!PHONE_RE.test(basics.ownerMobile)) errors.ownerMobile = t.errOwnerMobile;
  return errors;
}

export function OnboardingWizard({
  locale,
  accountEmail,
}: { locale: Locale; accountEmail: string }) {
  const dict = getDict(locale);
  const t = dict.onboarding;
  const [basics, setBasics] = useState<BusinessBasics>(() => ({
    ...defaultBasics(),
    email: accountEmail,
  }));
  const [plan, setPlan] = useState<Plan>("basic");
  const [billing, setBilling] = useState<Billing>("annual");
  const [planChosen, setPlanChosen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [cancelled, setCancelled] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hydrated = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only hydration, accountEmail is fixed for the page's life
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramPlan = params.get("plan");
    const paramBilling = params.get("billing");
    if (isPlan(paramPlan)) setPlan(paramPlan);
    if (isBilling(paramBilling)) setBilling(paramBilling);
    if (params.get("cancelled") === "1") setCancelled(true);

    let chosen = paramPlan !== null || paramBilling !== null;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as StoredWizard) : null;
      if (parsed?.planChosen === true) chosen = true;
      const restored = storedBasics(parsed?.basics);
      if (restored) {
        // A stale save from a previous login shouldn't resurrect that account's email.
        setBasics({ ...restored, email: accountEmail });
        if (paramPlan === null && isPlan(parsed?.plan)) setPlan(parsed.plan);
        if (paramBilling === null && isBilling(parsed?.billing)) setBilling(parsed.billing);
      } else {
        // US-only: the browser's guess is a convenience, not an option. Anything off the list
        // (a VPN, an owner on holiday, a non-US laptop) keeps the Eastern default, which the
        // owner can still change by hand.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (isTimezoneId(tz)) setBasics((b) => ({ ...b, timezone: tz }));
      }
    } catch {
      /* corrupted storage — start fresh */
    }
    setPlanChosen(chosen);
    setPickerOpen(!chosen);
    const ref = document.cookie
      .split(";")
      .map((c) => c.trim().split("="))
      .find(([name]) => name === "marisol_ref")?.[1];
    if (ref) setReferralCode(decodeURIComponent(ref).toUpperCase());
    hydrated.current = true;
    track("wizard_step", "basics");
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ basics, billing, plan, planChosen }));
    } catch {
      /* storage full/blocked — non-fatal */
    }
  }, [basics, billing, plan, planChosen]);

  const patch = (partial: Partial<BusinessBasics>) => setBasics((b) => ({ ...b, ...partial }));

  const choosePlan = (picked: Plan) => {
    setPlan(picked);
    setPlanChosen(true);
    setPickerOpen(false);
    track("plan_picked", `${picked}:${billing}`);
  };

  const dismissPicker = () => {
    // Leaves whatever is currently selected — on the first open that is the Base default, so closing
    // the dialog can never quietly upgrade anyone.
    setPlanChosen(true);
    setPickerOpen(false);
    track("plan_picker_dismissed", `${plan}:${billing}`);
  };

  const submit = async () => {
    const errs = validateBasics(basics, t);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "checkout",
          plan,
          billing,
          basics,
          locale,
          referralCode: referralCode.trim() || undefined,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { url?: string; error?: string; sessionId?: string };
      // Already subscribed — the salon is still being provisioned. Finish that setup rather than
      // showing an error next to a button that would have bought a second subscription.
      if (res.status === 409) {
        window.location.href = body.sessionId
          ? `/onboarding/thanks?session_id=${encodeURIComponent(body.sessionId)}`
          : "/portal";
        return;
      }
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? "checkout failed");
      }
      track("checkout_redirect", `${plan}:${billing}`);
      window.location.href = body.url;
    } catch {
      setSubmitError(t.errSubmit);
      setSubmitting(false);
    }
  };

  // One list, shared with the portal — a zone the portal can't render is a zone that silently
  // shows one value and submits another.
  const timezones = TIMEZONE_IDS.map((id) => ({ id: id as string, label: dict.timezones[id] }));

  return (
    <div className="mx-auto max-w-[720px] px-[22px] pb-[clamp(48px,7vw,88px)]">
      <div className="mb-7 text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          {t.badge}
        </span>
        <h1 className="mx-auto mt-[18px] max-w-[22ch] font-display text-[clamp(26px,4.4vw,40px)] font-light leading-[1.1] tracking-[-0.03em]">
          {t.title}
        </h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-[14.5px] leading-[1.55] text-muted">
          {t.subtitle}
        </p>
      </div>

      {cancelled && (
        <output className="mb-5 block rounded-[12px] bg-cream-200 px-4 py-3 text-[14px] text-muted">
          {t.cancelled}
        </output>
      )}

      <div className="rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
        <div className="flex flex-col gap-5">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-[10px] text-[13.5px] font-medium text-ink">
              {t.verticalLegend}
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {VERTICAL_IDS.map((id) => {
                const active = basics.vertical === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patch({ vertical: id as Vertical })}
                    className={`rounded-[16px] border px-[18px] py-4 text-left transition-all ${
                      active ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white/70 text-ink"
                    }`}
                  >
                    <span className="block text-[15px] font-medium">{t.verticals[id].label}</span>
                    <span
                      className={`mt-1 block text-[13px] leading-[1.45] ${
                        active ? "text-cream/70" : "text-muted"
                      }`}
                    >
                      {t.verticals[id].blurb}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field label={t.businessName} htmlFor="ob-business" error={errors.businessName}>
            <input
              id="ob-business"
              className={inputCls}
              value={basics.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
              placeholder={t.businessNamePlaceholder}
              autoComplete="organization"
            />
          </Field>

          <Field label={t.ownerName} htmlFor="ob-owner" error={errors.ownerName}>
            <input
              id="ob-owner"
              className={inputCls}
              value={basics.ownerName}
              onChange={(e) => patch({ ownerName: e.target.value })}
              placeholder={t.ownerNamePlaceholder}
              autoComplete="name"
            />
          </Field>
          <p className="-mt-2 text-[13px] text-muted-2">Signed in as {accountEmail}</p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label={t.businessPhone}
              htmlFor="ob-bizphone"
              error={errors.businessPhone}
              hint={t.businessPhoneHint}
            >
              <input
                id="ob-bizphone"
                type="tel"
                className={inputCls}
                value={basics.businessPhone}
                onChange={(e) => patch({ businessPhone: e.target.value })}
                placeholder={t.businessPhonePlaceholder}
                autoComplete="tel"
              />
            </Field>
            <Field
              label={t.ownerMobile}
              htmlFor="ob-mobile"
              error={errors.ownerMobile}
              hint={t.ownerMobileHint}
            >
              <input
                id="ob-mobile"
                type="tel"
                className={inputCls}
                value={basics.ownerMobile}
                onChange={(e) => patch({ ownerMobile: e.target.value })}
                placeholder={t.ownerMobilePlaceholder}
                autoComplete="tel"
              />
            </Field>
          </div>

          <Field label={t.timezone} htmlFor="ob-tz">
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

          <PlanSummary
            t={t}
            pricing={dict.pricing}
            plan={plan}
            billing={billing}
            onChange={() => setPickerOpen(true)}
          />

          <Field label={t.promoCode} htmlFor="ob-promo" hint={t.promoCodeHint}>
            <input
              id="ob-promo"
              className={inputCls}
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder={t.promoCodePlaceholder}
              autoCapitalize="characters"
              autoComplete="off"
            />
          </Field>

          <Field
            label={t.referral}
            htmlFor="ob-referral"
            hint={`${t.referralHint} ${t.referralEarn}`}
          >
            <input
              id="ob-referral"
              className={inputCls}
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder={t.referralPlaceholder}
              autoCapitalize="characters"
              autoComplete="off"
            />
          </Field>

          {submitError && (
            <p role="alert" className="text-center text-[13.5px] font-medium text-[#B4452C]">
              {submitError}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={locale === "es" ? "/es#pricing" : "/#pricing"}
            className="inline-flex min-h-[50px] items-center justify-center rounded-[13px] px-5 py-[14px] text-[15px] font-medium text-muted no-underline"
          >
            {t.back}
          </a>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream disabled:opacity-60"
          >
            {submitting
              ? t.submitting
              : fill(t.submit, { days: TRIAL_DAYS, price: PRICE[plan][billing] })}
          </button>
        </div>

        <p className="mt-4 text-center text-[13px] leading-[1.55] text-muted-2">
          {fill(t.trialNote, { days: TRIAL_DAYS })}
        </p>
      </div>

      <BookCallForm
        prefill={{
          name: basics.ownerName,
          email: basics.email,
          phone: basics.ownerMobile || basics.businessPhone,
        }}
        t={t}
        form={dict.callForm}
      />

      <PlanPickerModal
        open={pickerOpen}
        t={dict.pricing}
        locale={locale}
        billing={billing}
        onBillingChange={setBilling}
        onChoose={choosePlan}
        onDismiss={dismissPicker}
      />
    </div>
  );
}
